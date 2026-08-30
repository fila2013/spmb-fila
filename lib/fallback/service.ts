import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  StatusKeseluruhan,
  StatusPengumuman,
} from "@/generated/prisma/enums";
import { selectionAvailability } from "@/lib/calon-murid/rules";
import { FallbackError } from "@/lib/fallback/errors";
import {
  assertDeletionConfirmed,
  hasQuotaCapacity,
} from "@/lib/fallback/rules";
import { prisma } from "@/lib/prisma";

export type Transaction = Prisma.TransactionClient;
export type FallbackEffect =
  | { type: "TRANSFERRED"; targetJalurId: string }
  | { type: "QUEUED"; targetJalurId: string }
  | { type: "DELETED"; childId: string }
  | { type: "NONE" };

async function lockRoute(transaction: Transaction, id: string) {
  await transaction.$queryRaw`
    SELECT id FROM "jalur" WHERE id = ${id}::uuid FOR UPDATE
  `;
}

function fallbackAvailability(route: {
  statusAktif: boolean;
  periodeMulai: Date | null;
  periodeSelesai: Date | null;
  kuotaMaks: number | null;
  kuotaTerpakai: number;
}) {
  const availability = selectionAvailability(route);
  if (!availability.available && availability.reason !== "FULL") {
    throw new FallbackError(
      "FALLBACK_ROUTE_CLOSED",
      "Jalur fallback sedang tidak aktif atau berada di luar periode pendaftaran.",
      409,
    );
  }
  return availability;
}

async function transferWaitingChild(
  transaction: Transaction,
  child: {
    id: string;
    jalurId: string | null;
    jalurAsalId: string | null;
    menungguFallbackJalurId: string | null;
  },
  targetJalurId: string,
  actorId: string | null,
  source: "ANNOUNCEMENT" | "AUTO_REPROCESS" | "MANUAL_REPROCESS",
) {
  await transaction.jalur.update({
    where: { id: targetJalurId },
    data: { kuotaTerpakai: { increment: 1 } },
  });
  await transaction.calonMurid.update({
    where: { id: child.id },
    data: {
      jalurAsalId: child.jalurAsalId ?? child.jalurId,
      jalurId: targetJalurId,
      menungguFallbackJalurId: null,
      statusKeseluruhan: StatusKeseluruhan.DITERIMA,
    },
  });
  await transaction.pengumuman.update({
    where: { calonMuridId: child.id },
    data: {
      statusAkhir: StatusPengumuman.DITERIMA,
      updatedById: actorId,
    },
  });
  await transaction.auditLog.create({
    data: {
      actorId,
      action: "AUTO_TRANSFER_FALLBACK",
      entity: "calon_murid",
      entityId: child.id,
      detail: {
        source,
        fromJalurId: child.jalurId,
        toJalurId: targetJalurId,
        paymentReused: true,
        assessmentRepeated: false,
        nextStatus: StatusKeseluruhan.DITERIMA,
      },
    },
  });
}

async function queueChild(
  transaction: Transaction,
  childId: string,
  fromJalurId: string,
  targetJalurId: string,
  actorId: string | null,
) {
  await transaction.calonMurid.update({
    where: { id: childId },
    data: {
      menungguFallbackJalurId: targetJalurId,
      statusKeseluruhan: StatusKeseluruhan.MENUNGGU_KUOTA_FALLBACK,
    },
  });
  await transaction.pengumuman.update({
    where: { calonMuridId: childId },
    data: { statusAkhir: null, updatedById: actorId },
  });
  await transaction.auditLog.create({
    data: {
      actorId,
      action: "QUEUE_FALLBACK",
      entity: "calon_murid",
      entityId: childId,
      detail: {
        fromJalurId,
        targetJalurId,
        fifoTimestampSource: "calon_murid.created_at",
        nextStatus: StatusKeseluruhan.MENUNGGU_KUOTA_FALLBACK,
      },
    },
  });
}

async function autoDeleteChild(
  transaction: Transaction,
  child: Awaited<ReturnType<typeof deletionCandidate>>,
  actorId: string,
  confirmation: string | null | undefined,
) {
  if (!child?.jalur || !child.kategoriId) {
    throw new FallbackError(
      "INTEGRITY_ERROR",
      "Data jalur atau kategori calon murid tidak lengkap.",
      409,
    );
  }
  assertDeletionConfirmed(child.namaAnak, confirmation);
  await lockRoute(transaction, child.jalur.id);
  await transaction.$queryRaw`
    SELECT id FROM "kategori_pendaftar" WHERE id = ${child.kategoriId}::uuid FOR UPDATE
  `;

  const payments = await transaction.pembayaran.findMany({
    where: { calonMuridId: child.id },
    select: {
      id: true,
      calonMuridReference: true,
      jenis: true,
      metodePembayaran: true,
      nominal: true,
      status: true,
      midtransOrderId: true,
      midtransTransactionId: true,
      verifiedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  const formResponseCount = await transaction.formResponse.count({
    where: { calonMuridId: child.id },
  });
  const siblingCount = await transaction.calonMurid.count({
    where: { userId: child.userId, id: { not: child.id } },
  });

  await transaction.auditLog.create({
    data: {
      actorId,
      action: "AUTO_DELETE_CALON_MURID",
      entity: "calon_murid",
      entityId: child.id,
      detail: {
        snapshot: {
          id: child.id,
          userId: child.userId,
          namaAnak: child.namaAnak,
          jalur: { id: child.jalur.id, nama: child.jalur.nama },
          kategori: child.kategori
            ? { id: child.kategori.id, nama: child.kategori.nama }
            : null,
          jalurAsalId: child.jalurAsalId,
          statusKeseluruhan: child.statusKeseluruhan,
          assessmentStatus: child.hasilAssessment?.status ?? null,
          announcementStatus: child.pengumuman?.statusAkhir ?? null,
          formResponseCount,
          payments,
        },
        retention: {
          paymentsRetained: payments.length,
          paymentRelationSetNull: true,
          formResponsesDeleted: formResponseCount,
          siblingCountPreserved: siblingCount,
          userAccountPreserved: true,
        },
      },
    },
  });

  const routeQuota = await transaction.jalur.updateMany({
    where: { id: child.jalur.id, kuotaTerpakai: { gt: 0 } },
    data: { kuotaTerpakai: { decrement: 1 } },
  });
  const categoryQuota = await transaction.kategoriPendaftar.updateMany({
    where: { id: child.kategoriId, kuotaTerpakai: { gt: 0 } },
    data: { kuotaTerpakai: { decrement: 1 } },
  });
  if (routeQuota.count !== 1 || categoryQuota.count !== 1) {
    throw new FallbackError(
      "INTEGRITY_ERROR",
      "Kuota jalur atau kategori tidak konsisten; penghapusan dibatalkan.",
      409,
    );
  }
  await transaction.calonMurid.delete({ where: { id: child.id } });
}

function deletionCandidate(transaction: Transaction, childId: string) {
  return transaction.calonMurid.findUnique({
    where: { id: childId },
    include: {
      jalur: true,
      kategori: { select: { id: true, nama: true } },
      hasilAssessment: { select: { status: true } },
      pengumuman: { select: { statusAkhir: true } },
    },
  });
}

export async function handleRejectedDecisionInTransaction(
  transaction: Transaction,
  childId: string,
  actorId: string | null,
  confirmation?: string | null,
): Promise<FallbackEffect> {
  const child = await deletionCandidate(transaction, childId);
  if (!child?.jalur) {
    throw new FallbackError("NOT_FOUND", "Peserta atau jalur tidak ditemukan.", 404);
  }

  if (child.jalur.fallbackJalurId) {
    await lockRoute(transaction, child.jalur.fallbackJalurId);
    const target = await transaction.jalur.findUnique({
      where: { id: child.jalur.fallbackJalurId },
    });
    if (!target) {
      throw new FallbackError(
        "FALLBACK_NOT_FOUND",
        "Jalur fallback tidak ditemukan.",
        409,
      );
    }
    const availability = fallbackAvailability(target);
    if (!availability.available) {
      await queueChild(
        transaction,
        child.id,
        child.jalur.id,
        target.id,
        actorId,
      );
      return { type: "QUEUED", targetJalurId: target.id };
    }
    await transferWaitingChild(
      transaction,
      child,
      target.id,
      actorId,
      "ANNOUNCEMENT",
    );
    return { type: "TRANSFERRED", targetJalurId: target.id };
  }

  if (child.jalur.hapusDataJikaGagal) {
    if (!actorId) {
      throw new FallbackError(
        "AUTO_DELETE_CONFIRMATION_REQUIRED",
        "Penghapusan calon murid harus dikonfirmasi administrator.",
        409,
      );
    }
    await autoDeleteChild(transaction, child, actorId, confirmation);
    return { type: "DELETED", childId: child.id };
  }
  return { type: "NONE" };
}

export async function listFallbackQueue(jalurId: string) {
  const route = await prisma.jalur.findUnique({
    where: { id: jalurId },
    select: { id: true, nama: true, kuotaMaks: true, kuotaTerpakai: true },
  });
  if (!route) throw new FallbackError("NOT_FOUND", "Jalur tidak ditemukan.", 404);
  const queue = await prisma.calonMurid.findMany({
    where: {
      menungguFallbackJalurId: jalurId,
      statusKeseluruhan: StatusKeseluruhan.MENUNGGU_KUOTA_FALLBACK,
    },
    include: {
      user: { select: { email: true } },
      jalur: { select: { id: true, nama: true } },
      kategori: { select: { id: true, nama: true } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return {
    route,
    queue: queue.map((item, index) => ({ ...item, position: index + 1 })),
  };
}

export async function reprocessFallbackQueueInTransaction(
  transaction: Transaction,
  jalurId: string,
  actorId: string,
  source: "AUTO_REPROCESS" | "MANUAL_REPROCESS",
) {
  await lockRoute(transaction, jalurId);
  const route = await transaction.jalur.findUnique({ where: { id: jalurId } });
  if (!route) throw new FallbackError("NOT_FOUND", "Jalur tidak ditemukan.", 404);

  const availability = selectionAvailability(route);
  let stoppedReason: "EMPTY" | "FULL" | "CLOSED" = "EMPTY";
  let processed = 0;
  if (!availability.available && availability.reason !== "FULL") {
    stoppedReason = "CLOSED";
  } else {
    while (hasQuotaCapacity({
      kuotaMaks: route.kuotaMaks,
      kuotaTerpakai: route.kuotaTerpakai + processed,
    })) {
      const candidateRows = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM "calon_murid"
        WHERE "menunggu_fallback_jalur_id" = ${jalurId}::uuid
          AND "status_keseluruhan" = 'menunggu_kuota_fallback'::"status_keseluruhan"
        ORDER BY "created_at" ASC, id ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `;
      const candidateId = candidateRows[0]?.id;
      if (!candidateId) break;
      const candidate = await transaction.calonMurid.findUnique({
        where: { id: candidateId },
        select: {
          id: true,
          jalurId: true,
          jalurAsalId: true,
          menungguFallbackJalurId: true,
        },
      });
      if (!candidate) continue;
      await transferWaitingChild(
        transaction,
        candidate,
        jalurId,
        actorId,
        source,
      );
      processed += 1;
    }
    if (!hasQuotaCapacity({
      kuotaMaks: route.kuotaMaks,
      kuotaTerpakai: route.kuotaTerpakai + processed,
    })) stoppedReason = "FULL";
  }

  const remaining = await transaction.calonMurid.count({
    where: {
      menungguFallbackJalurId: jalurId,
      statusKeseluruhan: StatusKeseluruhan.MENUNGGU_KUOTA_FALLBACK,
    },
  });
  await transaction.auditLog.create({
    data: {
      actorId,
      action: "REPROCESS_FALLBACK_QUEUE",
      entity: "jalur",
      entityId: jalurId,
      detail: { source, processed, remaining, stoppedReason },
    },
  });
  return { processed, remaining, stoppedReason };
}

export function reprocessFallbackQueue(jalurId: string, actorId: string) {
  return prisma.$transaction(
    (transaction) =>
      reprocessFallbackQueueInTransaction(
        transaction,
        jalurId,
        actorId,
        "MANUAL_REPROCESS",
      ),
    { maxWait: 20_000, timeout: 60_000 },
  );
}
