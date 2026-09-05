import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  PilihanJalurFinal,
  StatusKeseluruhan,
  StatusPengumuman,
} from "@/generated/prisma/enums";
import { assertOwnership } from "@/lib/auth/authorization";
import { CalonMuridError } from "@/lib/calon-murid/errors";
import { hasQuotaCapacity } from "@/lib/fallback/rules";
import type { FinalRouteChoiceInput } from "@/lib/final-route-choice/schemas";
import { isAnnouncementReleased } from "@/lib/stages/rules";
import { prisma } from "@/lib/prisma";

type Transaction = Prisma.TransactionClient;

async function lockRoutes(transaction: Transaction, routeIds: string[]) {
  for (const routeId of [...new Set(routeIds)].sort()) {
    await transaction.$queryRaw`
      SELECT id FROM "jalur" WHERE id = ${routeId}::uuid FOR UPDATE
    `;
  }
}

function alreadySelectedResult(child: {
  pilihanJalurFinal: PilihanJalurFinal;
  statusKeseluruhan: StatusKeseluruhan;
  jalurId: string | null;
  menungguFallbackJalurId: string | null;
}) {
  return {
    pilihan: child.pilihanJalurFinal,
    queued:
      child.statusKeseluruhan ===
      StatusKeseluruhan.MENUNGGU_KUOTA_FALLBACK,
    jalurId: child.jalurId,
    targetJalurId: child.menungguFallbackJalurId,
    statusKeseluruhan: child.statusKeseluruhan,
    idempotent: true,
  };
}

export function chooseFinalRoute(
  childId: string,
  input: FinalRouteChoiceInput,
  userId: string,
) {
  return prisma.$transaction(
    async (transaction) => {
      await transaction.$queryRaw`
        SELECT id FROM "calon_murid" WHERE id = ${childId}::uuid FOR UPDATE
      `;
      let child = await transaction.calonMurid.findUnique({
        where: { id: childId },
        include: { jalur: true, pengumuman: true },
      });
      if (!child) {
        throw new CalonMuridError(
          "NOT_FOUND",
          "Peserta tidak ditemukan.",
          404,
        );
      }
      assertOwnership({ userId, role: "WALI_MURID" }, child.userId);

      if (child.pilihanJalurFinal) {
        if (child.pilihanJalurFinal !== input.pilihan) {
          throw new CalonMuridError(
            "FINAL_ROUTE_CHOICE_LOCKED",
            "Pilihan jalur final sudah disimpan dan tidak dapat diubah.",
            409,
          );
        }
        return alreadySelectedResult({
          pilihanJalurFinal: child.pilihanJalurFinal,
          statusKeseluruhan: child.statusKeseluruhan,
          jalurId: child.jalurId,
          menungguFallbackJalurId: child.menungguFallbackJalurId,
        });
      }

      if (!child.jalur) {
        throw new CalonMuridError(
          "NOT_FOUND",
          "Jalur asal peserta tidak ditemukan.",
          404,
        );
      }

      if (
        child.statusKeseluruhan !==
          StatusKeseluruhan.MENUNGGU_PILIHAN_JALUR ||
        child.pengumuman?.statusAkhir !== StatusPengumuman.DITERIMA ||
        !isAnnouncementReleased(child.pengumuman.tanggalRilis)
      ) {
        throw new CalonMuridError(
          "INVALID_STAGE",
          "Pilihan jalur final belum tersedia pada tahap ini.",
          409,
        );
      }
      if (
        !child.jalur.pilihanJalurFinalAktif ||
        !child.jalur.fallbackJalurId
      ) {
        throw new CalonMuridError(
          "FINAL_ROUTE_CHOICE_DISABLED",
          "Pilihan jalur final tidak diaktifkan oleh panitia.",
          409,
        );
      }

      const sourceRouteId = child.jalur.id;
      const targetRouteId = child.jalur.fallbackJalurId;
      await lockRoutes(transaction, [sourceRouteId, targetRouteId]);
      child = await transaction.calonMurid.findUnique({
        where: { id: childId },
        include: { jalur: true, pengumuman: true },
      });
      if (
        !child?.jalur ||
        child.pilihanJalurFinal ||
        child.statusKeseluruhan !==
          StatusKeseluruhan.MENUNGGU_PILIHAN_JALUR ||
        child.jalur.id !== sourceRouteId ||
        child.jalur.fallbackJalurId !== targetRouteId
      ) {
        throw new CalonMuridError(
          "FINAL_ROUTE_CHOICE_LOCKED",
          "Status atau konfigurasi jalur berubah. Muat ulang halaman sebelum memilih.",
          409,
        );
      }

      const now = new Date();
      if (input.pilihan === PilihanJalurFinal.TETAP_JALUR_ASAL) {
        const updated = await transaction.calonMurid.update({
          where: { id: childId },
          data: {
            pilihanJalurFinal: input.pilihan,
            pilihanJalurFinalAt: now,
            statusKeseluruhan: StatusKeseluruhan.DITERIMA,
          },
        });
        await transaction.auditLog.create({
          data: {
            actorId: userId,
            action: "SELECT_FINAL_ROUTE",
            entity: "calon_murid",
            entityId: childId,
            detail: {
              pilihan: input.pilihan,
              fromJalurId: sourceRouteId,
              toJalurId: sourceRouteId,
              sourceQuotaReleased: false,
              targetQuotaReserved: true,
              queued: false,
              nextStatus: updated.statusKeseluruhan,
            },
          },
        });
        return {
          pilihan: input.pilihan,
          queued: false,
          jalurId: updated.jalurId,
          targetJalurId: sourceRouteId,
          statusKeseluruhan: updated.statusKeseluruhan,
          idempotent: false,
        };
      }

      const releasedSource = await transaction.jalur.updateMany({
        where: { id: sourceRouteId, kuotaTerpakai: { gt: 0 } },
        data: { kuotaTerpakai: { decrement: 1 } },
      });
      if (releasedSource.count !== 1) {
        throw new CalonMuridError(
          "INTEGRITY_ERROR",
          "Kuota jalur asal tidak konsisten; pilihan dibatalkan.",
          409,
        );
      }
      const target = await transaction.jalur.findUnique({
        where: { id: targetRouteId },
      });
      if (!target) {
        throw new CalonMuridError(
          "NOT_FOUND",
          "Jalur reguler/fallback tidak ditemukan.",
          404,
        );
      }
      const targetAvailable = hasQuotaCapacity(target);
      if (targetAvailable) {
        await transaction.jalur.update({
          where: { id: targetRouteId },
          data: { kuotaTerpakai: { increment: 1 } },
        });
      }
      const nextStatus = targetAvailable
        ? StatusKeseluruhan.DITERIMA
        : StatusKeseluruhan.MENUNGGU_KUOTA_FALLBACK;
      const updated = await transaction.calonMurid.update({
        where: { id: childId },
        data: {
          jalurAsalId: sourceRouteId,
          jalurId: targetAvailable ? targetRouteId : null,
          menungguFallbackJalurId: targetAvailable ? null : targetRouteId,
          pilihanJalurFinal: input.pilihan,
          pilihanJalurFinalAt: now,
          statusKeseluruhan: nextStatus,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: userId,
          action: targetAvailable
            ? "SELECT_FINAL_ROUTE"
            : "QUEUE_FINAL_ROUTE_CHOICE",
          entity: "calon_murid",
          entityId: childId,
          detail: {
            pilihan: input.pilihan,
            fromJalurId: sourceRouteId,
            toJalurId: targetRouteId,
            sourceQuotaReleased: true,
            targetQuotaReserved: targetAvailable,
            queued: !targetAvailable,
            fifoTimestampSource: targetAvailable
              ? null
              : "calon_murid.created_at",
            nextStatus,
          },
        },
      });
      return {
        pilihan: input.pilihan,
        queued: !targetAvailable,
        jalurId: updated.jalurId,
        targetJalurId: targetRouteId,
        statusKeseluruhan: updated.statusKeseluruhan,
        idempotent: false,
      };
    },
    { maxWait: 20_000, timeout: 60_000 },
  );
}
