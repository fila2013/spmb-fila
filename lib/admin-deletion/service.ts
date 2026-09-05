import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  StatusKeseluruhan,
  UserRole,
} from "@/generated/prisma/enums";
import { AdminDeletionError } from "@/lib/admin-deletion/errors";
import {
  assertDeletionConfirmed,
  assertGuardianHasNoChildren,
} from "@/lib/admin-deletion/rules";
import type {
  DeleteGuardianInput,
  DeleteParticipantInput,
} from "@/lib/admin-deletion/schemas";
import { reprocessFallbackQueueInTransaction } from "@/lib/fallback/service";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

type Transaction = Prisma.TransactionClient;

const retainedPaymentSelect = {
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
} satisfies Prisma.PembayaranSelect;

async function lockParticipant(transaction: Transaction, id: string) {
  await transaction.$queryRaw`
    SELECT id FROM "calon_murid" WHERE id = ${id}::uuid FOR UPDATE
  `;
}

async function lockGuardian(transaction: Transaction, id: string) {
  await transaction.$queryRaw`
    SELECT id FROM "users" WHERE id = ${id}::uuid FOR UPDATE
  `;
}

async function lockRoute(transaction: Transaction, id: string | null) {
  if (!id) return;
  await transaction.$queryRaw`
    SELECT id FROM "jalur" WHERE id = ${id}::uuid FOR UPDATE
  `;
}

async function lockCategory(transaction: Transaction, id: string | null) {
  if (!id) return;
  await transaction.$queryRaw`
    SELECT id FROM "kategori_pendaftar" WHERE id = ${id}::uuid FOR UPDATE
  `;
}

async function decrementRoute(transaction: Transaction, id: string | null) {
  if (!id) return;
  const result = await transaction.jalur.updateMany({
    where: { id, kuotaTerpakai: { gt: 0 } },
    data: { kuotaTerpakai: { decrement: 1 } },
  });
  if (result.count !== 1) {
    throw new AdminDeletionError(
      "QUOTA_INTEGRITY_ERROR",
      "Kuota jalur tidak konsisten; penghapusan dibatalkan.",
      409,
    );
  }
}

async function decrementCategory(transaction: Transaction, id: string | null) {
  if (!id) return;
  const result = await transaction.kategoriPendaftar.updateMany({
    where: { id, kuotaTerpakai: { gt: 0 } },
    data: { kuotaTerpakai: { decrement: 1 } },
  });
  if (result.count !== 1) {
    throw new AdminDeletionError(
      "QUOTA_INTEGRITY_ERROR",
      "Kuota kategori tidak konsisten; penghapusan dibatalkan.",
      409,
    );
  }
}

export function listGuardians(query?: string) {
  return prisma.user.findMany({
    where: {
      role: UserRole.WALI_MURID,
      ...(query
        ? {
            OR: [
              { email: { contains: query, mode: "insensitive" as const } },
              {
                calonMurid: {
                  some: {
                    namaAnak: { contains: query, mode: "insensitive" as const },
                  },
                },
              },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      email: true,
      statusAktif: true,
      createdAt: true,
      _count: { select: { calonMurid: true } },
      calonMurid: {
        select: { id: true, namaAnak: true },
        orderBy: [{ createdAt: "asc" }, { namaAnak: "asc" }],
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function deleteParticipant(
  input: DeleteParticipantInput,
  actorId: string,
) {
  return prisma.$transaction(
    async (transaction) => {
      await lockParticipant(transaction, input.id);
      const participant = await transaction.calonMurid.findUnique({
        where: { id: input.id },
        include: {
          user: { select: { id: true, email: true } },
          jalur: { select: { id: true, nama: true } },
          kategori: { select: { id: true, nama: true } },
          hasilAssessment: { select: { status: true } },
          pengumuman: { select: { statusAkhir: true } },
          statusGrupWa: { select: { status: true } },
        },
      });
      if (!participant) {
        throw new AdminDeletionError(
          "PARTICIPANT_NOT_FOUND",
          "Peserta tidak ditemukan.",
          404,
        );
      }
      assertDeletionConfirmed(participant.namaAnak, input.confirmation);

      await lockRoute(transaction, participant.jalurId);
      await lockCategory(transaction, participant.kategoriId);

      const payments = await transaction.pembayaran.findMany({
        where: { calonMuridId: participant.id },
        select: retainedPaymentSelect,
        orderBy: { createdAt: "asc" },
      });
      const formResponseCount = await transaction.formResponse.count({
        where: { calonMuridId: participant.id },
      });
      const siblingCount = await transaction.calonMurid.count({
        where: { userId: participant.userId, id: { not: participant.id } },
      });

      await transaction.auditLog.create({
        data: {
          actorId,
          action: "MANUAL_DELETE_CALON_MURID",
          entity: "calon_murid",
          entityId: participant.id,
          detail: {
            snapshot: {
              id: participant.id,
              userId: participant.user.id,
              guardianEmail: participant.user.email,
              namaAnak: participant.namaAnak,
              jalur: participant.jalur,
              kategori: participant.kategori,
              jalurAsalId: participant.jalurAsalId,
              menungguFallbackJalurId: participant.menungguFallbackJalurId,
              pilihanJalurFinal: participant.pilihanJalurFinal,
              pilihanJalurFinalAt: participant.pilihanJalurFinalAt,
              statusKeseluruhan: participant.statusKeseluruhan,
              assessmentStatus: participant.hasilAssessment?.status ?? null,
              announcementStatus: participant.pengumuman?.statusAkhir ?? null,
              whatsappStatus: participant.statusGrupWa?.status ?? null,
              formResponseCount,
              payments,
              createdAt: participant.createdAt,
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

      await decrementRoute(transaction, participant.jalurId);
      await decrementCategory(transaction, participant.kategoriId);
      await transaction.calonMurid.delete({ where: { id: participant.id } });

      let fallbackReprocessed = 0;
      if (participant.jalurId) {
        const waitingCount = await transaction.calonMurid.count({
          where: {
            menungguFallbackJalurId: participant.jalurId,
            statusKeseluruhan:
              StatusKeseluruhan.MENUNGGU_KUOTA_FALLBACK,
          },
        });
        if (waitingCount > 0) {
          const result = await reprocessFallbackQueueInTransaction(
            transaction,
            participant.jalurId,
            actorId,
            "AUTO_REPROCESS",
          );
          fallbackReprocessed = result.processed;
        }
      }

      return {
        id: participant.id,
        guardianId: participant.userId,
        paymentsRetained: payments.length,
        siblingCount,
        fallbackReprocessed,
      };
    },
    { maxWait: 20_000, timeout: 60_000 },
  );
}

function isMissingAuthUser(error: { status?: number; code?: string } | null) {
  return Boolean(
    error &&
      (error.status === 404 ||
        error.code === "user_not_found" ||
        error.code === "not_found"),
  );
}

export async function deleteGuardian(
  input: DeleteGuardianInput,
  actorId: string,
) {
  const guardian = await prisma.$transaction(async (transaction) => {
    await lockGuardian(transaction, input.id);
    const target = await transaction.user.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        supabaseAuthUserId: true,
        email: true,
        role: true,
        statusAktif: true,
        createdAt: true,
        _count: { select: { calonMurid: true } },
      },
    });
    if (!target) {
      throw new AdminDeletionError(
        "GUARDIAN_NOT_FOUND",
        "Akun wali tidak ditemukan.",
        404,
      );
    }
    if (target.role !== UserRole.WALI_MURID) {
      throw new AdminDeletionError(
        "ADMIN_DELETE_FORBIDDEN",
        "Fitur ini hanya dapat menghapus akun wali murid.",
        403,
      );
    }
    assertGuardianHasNoChildren(target._count.calonMurid);
    assertDeletionConfirmed(target.email, input.confirmation);

    await transaction.user.update({
      where: { id: target.id },
      data: { statusAktif: false },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "DELETE_WALI_MURID_STARTED",
        entity: "user",
        entityId: target.id,
        detail: {
          snapshot: {
            id: target.id,
            supabaseAuthUserId: target.supabaseAuthUserId,
            email: target.email,
            role: target.role,
            statusAktif: target.statusAktif,
            childCount: target._count.calonMurid,
            createdAt: target.createdAt,
          },
          authDeletionRequested: true,
        },
      },
    });
    return target;
  });

  const supabase = createAdminClient();
  const lookup = await supabase.auth.admin.getUserById(
    guardian.supabaseAuthUserId,
  );
  if (lookup.error && !isMissingAuthUser(lookup.error)) {
    throw new AdminDeletionError(
      "AUTH_DELETE_FAILED",
      "Identitas autentikasi belum dapat dihapus. Akun telah dinonaktifkan dan penghapusan dapat dicoba kembali.",
      502,
    );
  }
  if (lookup.data.user) {
    const deletion = await supabase.auth.admin.deleteUser(
      guardian.supabaseAuthUserId,
      false,
    );
    if (deletion.error && !isMissingAuthUser(deletion.error)) {
      throw new AdminDeletionError(
        "AUTH_DELETE_FAILED",
        "Identitas autentikasi belum dapat dihapus. Akun telah dinonaktifkan dan penghapusan dapat dicoba kembali.",
        502,
      );
    }

    const verification = await supabase.auth.admin.getUserById(
      guardian.supabaseAuthUserId,
    );
    if (
      (!verification.error && verification.data.user) ||
      (verification.error && !isMissingAuthUser(verification.error))
    ) {
      throw new AdminDeletionError(
        "AUTH_DELETE_FAILED",
        "Identitas autentikasi belum dapat dipastikan terhapus. Akun telah dinonaktifkan dan penghapusan dapat dicoba kembali.",
        502,
      );
    }
  }

  await prisma.$transaction(async (transaction) => {
    await lockGuardian(transaction, guardian.id);
    const target = await transaction.user.findUnique({
      where: { id: guardian.id },
      select: {
        id: true,
        role: true,
        _count: { select: { calonMurid: true } },
      },
    });
    if (target && target.role !== UserRole.WALI_MURID) {
      throw new AdminDeletionError(
        "ADMIN_DELETE_FORBIDDEN",
        "Role akun berubah; penghapusan profil dibatalkan.",
        409,
      );
    }
    if (target) assertGuardianHasNoChildren(target._count.calonMurid);
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "DELETE_WALI_MURID_COMPLETED",
        entity: "user",
        entityId: guardian.id,
        detail: {
          snapshot: {
            id: guardian.id,
            supabaseAuthUserId: guardian.supabaseAuthUserId,
            email: guardian.email,
            role: guardian.role,
            childCount: 0,
            createdAt: guardian.createdAt,
          },
          authIdentityDeleted: true,
          applicationProfileDeleted: true,
          applicationProfileDeletedByAuthTrigger: !target,
        },
      },
    });
    if (target) {
      await transaction.user.delete({ where: { id: guardian.id } });
    }
  });

  return { id: guardian.id, email: guardian.email };
}
