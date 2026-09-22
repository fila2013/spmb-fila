import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  JenisPembayaran,
  StatusHoldKuota,
  StatusKeseluruhan,
  StatusPembayaran,
} from "@/generated/prisma/enums";
import { CalonMuridError } from "@/lib/calon-murid/errors";
import { PaymentError } from "@/lib/payment/errors";
import { prisma } from "@/lib/prisma";
import {
  CRITICAL_QUOTA_HOLD_MESSAGE,
  DEFAULT_HOLD_DURATION_MINUTES,
  holdExpiry,
  isActivePendingHold,
  quotaBlockingReason,
} from "@/lib/quota-hold/rules";

type Transaction = Prisma.TransactionClient;

type HoldReleaseReason = "EXPIRED" | "CANCELLED";

async function lockChild(transaction: Transaction, childId: string) {
  await transaction.$queryRaw`
    SELECT id FROM "calon_murid" WHERE id = ${childId}::uuid FOR UPDATE
  `;
}

async function lockHold(transaction: Transaction, childId: string) {
  await transaction.$queryRaw`
    SELECT id FROM "hold_kuota_pendaftaran"
    WHERE "calon_murid_id" = ${childId}::uuid
    FOR UPDATE
  `;
}

async function lockRouteAndCategory(
  transaction: Transaction,
  routeId: string,
  categoryId: string,
) {
  await transaction.$queryRaw`
    SELECT id FROM "jalur" WHERE id = ${routeId}::uuid FOR UPDATE
  `;
  await transaction.$queryRaw`
    SELECT id FROM "kategori_pendaftar"
    WHERE id = ${categoryId}::uuid FOR UPDATE
  `;
}

function holdCountMap<T extends string | null>(
  rows: Array<{ key: T; count: number }>,
) {
  return new Map(
    rows
      .filter((row): row is { key: Exclude<T, null>; count: number } =>
        Boolean(row.key),
      )
      .map((row) => [row.key, row.count]),
  );
}

export async function activeRouteHoldCounts(now = new Date()) {
  const rows = await prisma.holdKuotaPendaftaran.groupBy({
    by: ["jalurId"],
    where: {
      status: StatusHoldKuota.PENDING_PAYMENT,
      expiresAt: { gt: now },
      jalurId: { not: null },
    },
    _count: { _all: true },
  });
  return holdCountMap(
    rows.map((row) => ({ key: row.jalurId, count: row._count._all })),
  );
}

export async function activeCategoryHoldCounts(now = new Date()) {
  const rows = await prisma.holdKuotaPendaftaran.groupBy({
    by: ["kategoriId"],
    where: {
      status: StatusHoldKuota.PENDING_PAYMENT,
      expiresAt: { gt: now },
    },
    _count: { _all: true },
  });
  return holdCountMap(
    rows.map((row) => ({ key: row.kategoriId, count: row._count._all })),
  );
}

export async function countActiveRouteHoldsInTransaction(
  transaction: Transaction,
  routeId: string,
  now = new Date(),
  excludeChildId?: string,
) {
  return transaction.holdKuotaPendaftaran.count({
    where: {
      jalurId: routeId,
      status: StatusHoldKuota.PENDING_PAYMENT,
      expiresAt: { gt: now },
      ...(excludeChildId ? { calonMuridId: { not: excludeChildId } } : {}),
    },
  });
}

export async function countActiveCategoryHoldsInTransaction(
  transaction: Transaction,
  categoryId: string,
  now: Date,
  excludeChildId?: string,
) {
  return transaction.holdKuotaPendaftaran.count({
    where: {
      kategoriId: categoryId,
      status: StatusHoldKuota.PENDING_PAYMENT,
      expiresAt: { gt: now },
      ...(excludeChildId ? { calonMuridId: { not: excludeChildId } } : {}),
    },
  });
}

function assertHoldCapacity(input: {
  kuotaMaks: number | null;
  kuotaTerpakai: number;
  kuotaDitahan: number;
}) {
  const reason = quotaBlockingReason(input);
  if (reason === "HELD") {
    throw new CalonMuridError(
      "QUOTA_HELD",
      CRITICAL_QUOTA_HOLD_MESSAGE,
      409,
    );
  }
  if (reason === "FULL") {
    throw new CalonMuridError(
      "QUOTA_FULL",
      "Kuota sudah penuh. Silakan menunggu admin menambah kuota atau pilih opsi lain yang tersedia.",
      409,
    );
  }
}

export async function reserveRegistrationQuotaInTransaction(
  transaction: Transaction,
  child: { id: string; jalurId: string; kategoriId: string },
  actorId: string,
) {
  const now = new Date();
  await lockChild(transaction, child.id);
  await lockHold(transaction, child.id);
  await lockRouteAndCategory(transaction, child.jalurId, child.kategoriId);

  const previous = await transaction.holdKuotaPendaftaran.findUnique({
    where: { calonMuridId: child.id },
  });
  if (
    isActivePendingHold(previous, now) &&
    previous?.jalurId === child.jalurId &&
    previous.kategoriId === child.kategoriId
  ) {
    return { hold: previous, reused: true };
  }
  if (previous?.status === StatusHoldKuota.VERIFIED) {
    throw new CalonMuridError(
      "INVALID_STAGE",
      "Kuota peserta sudah dikonfirmasi oleh pembayaran terverifikasi.",
      409,
    );
  }

  const [route, category, routeHolds, categoryHolds, setting] =
    await Promise.all([
      transaction.jalur.findUnique({ where: { id: child.jalurId } }),
      transaction.kategoriPendaftar.findUnique({
        where: { id: child.kategoriId },
      }),
      countActiveRouteHoldsInTransaction(
        transaction,
        child.jalurId,
        now,
        child.id,
      ),
      countActiveCategoryHoldsInTransaction(
        transaction,
        child.kategoriId,
        now,
        child.id,
      ),
      transaction.pengaturanPembayaran.findUnique({
        where: { id: "pendaftaran" },
        select: { holdDurationMinutes: true },
      }),
    ]);
  if (!route || !category) {
    throw new CalonMuridError(
      "NOT_FOUND",
      "Jalur atau kategori tidak ditemukan.",
      404,
    );
  }
  assertHoldCapacity({
    kuotaMaks: route.kuotaMaks,
    kuotaTerpakai: route.kuotaTerpakai,
    kuotaDitahan: routeHolds,
  });
  assertHoldCapacity({
    kuotaMaks: category.kuotaMaks,
    kuotaTerpakai: category.kuotaTerpakai,
    kuotaDitahan: categoryHolds,
  });

  const expiresAt = holdExpiry(
    setting?.holdDurationMinutes ?? DEFAULT_HOLD_DURATION_MINUTES,
    now,
  );
  await transaction.pembayaran.updateMany({
    where: {
      calonMuridReference: child.id,
      jenis: JenisPembayaran.PENDAFTARAN,
      status: StatusPembayaran.PENDING,
    },
    data: {
      status: StatusPembayaran.REJECTED,
      catatanAdmin: "Hold kuota sebelumnya berakhir atau diganti.",
      verifiedAt: null,
      verifiedById: null,
    },
  });
  const hold = await transaction.holdKuotaPendaftaran.upsert({
    where: { calonMuridId: child.id },
    update: {
      jalurId: child.jalurId,
      kategoriId: child.kategoriId,
      status: StatusHoldKuota.PENDING_PAYMENT,
      expiresAt,
      verifiedAt: null,
      releasedAt: null,
    },
    create: {
      calonMuridId: child.id,
      jalurId: child.jalurId,
      kategoriId: child.kategoriId,
      status: StatusHoldKuota.PENDING_PAYMENT,
      expiresAt,
    },
  });
  await transaction.auditLog.create({
    data: {
      actorId,
      action: "CREATE_REGISTRATION_QUOTA_HOLD",
      entity: "hold_kuota_pendaftaran",
      entityId: hold.id,
      detail: {
        calonMuridId: child.id,
        jalurId: child.jalurId,
        kategoriId: child.kategoriId,
        status: hold.status,
        expiresAt: hold.expiresAt,
        previousStatus: previous?.status ?? null,
      },
    },
  });
  return { hold, reused: false };
}

export async function getRegistrationQuotaHold(childId: string) {
  return prisma.holdKuotaPendaftaran.findUnique({
    where: { calonMuridId: childId },
  });
}

export async function requireActiveRegistrationHoldInTransaction(
  transaction: Transaction,
  childId: string,
) {
  await lockHold(transaction, childId);
  const hold = await transaction.holdKuotaPendaftaran.findUnique({
    where: { calonMuridId: childId },
  });
  if (!isActivePendingHold(hold)) {
    throw new PaymentError(
      "HOLD_EXPIRED",
      "Waktu pembayaran telah berakhir. Silakan kembali memilih jalur dan kategori untuk mencoba lagi.",
      409,
    );
  }
  return hold!;
}

export async function verifyRegistrationQuotaHoldInTransaction(
  transaction: Transaction,
  childId: string,
  paymentId: string,
  actorId: string | null,
) {
  const now = new Date();
  await lockChild(transaction, childId);
  await lockHold(transaction, childId);
  const hold = await transaction.holdKuotaPendaftaran.findUnique({
    where: { calonMuridId: childId },
  });
  if (hold?.status === StatusHoldKuota.VERIFIED) return hold;
  if (!isActivePendingHold(hold, now) || !hold?.jalurId) {
    throw new PaymentError(
      "HOLD_EXPIRED",
      "Hold kuota pembayaran sudah berakhir. Pembayaran tidak dapat dikonfirmasi otomatis; hubungi panitia.",
      409,
    );
  }

  await lockRouteAndCategory(transaction, hold.jalurId, hold.kategoriId);
  const [route, category] = await Promise.all([
    transaction.jalur.findUnique({ where: { id: hold.jalurId } }),
    transaction.kategoriPendaftar.findUnique({
      where: { id: hold.kategoriId },
    }),
  ]);
  if (!route || !category) {
    throw new PaymentError(
      "QUOTA_INTEGRITY_ERROR",
      "Data kuota jalur atau kategori tidak ditemukan.",
      409,
    );
  }
  if (
    quotaBlockingReason({
      kuotaMaks: route.kuotaMaks,
      kuotaTerpakai: route.kuotaTerpakai,
    }) === "FULL" ||
    quotaBlockingReason({
      kuotaMaks: category.kuotaMaks,
      kuotaTerpakai: category.kuotaTerpakai,
    }) === "FULL"
  ) {
    throw new PaymentError(
      "QUOTA_INTEGRITY_ERROR",
      "Kuota berubah saat pembayaran diproses. Konfirmasi otomatis dibatalkan untuk mencegah kelebihan kuota.",
      409,
    );
  }

  await transaction.jalur.update({
    where: { id: hold.jalurId },
    data: { kuotaTerpakai: { increment: 1 } },
  });
  await transaction.kategoriPendaftar.update({
    where: { id: hold.kategoriId },
    data: { kuotaTerpakai: { increment: 1 } },
  });
  const verified = await transaction.holdKuotaPendaftaran.update({
    where: { id: hold.id },
    data: {
      status: StatusHoldKuota.VERIFIED,
      verifiedAt: now,
      releasedAt: null,
    },
  });
  await transaction.auditLog.create({
    data: {
      actorId,
      action: "VERIFY_REGISTRATION_QUOTA_HOLD",
      entity: "hold_kuota_pendaftaran",
      entityId: hold.id,
      detail: {
        calonMuridId: childId,
        paymentId,
        jalurId: hold.jalurId,
        kategoriId: hold.kategoriId,
        before: hold.status,
        after: verified.status,
      },
    },
  });
  return verified;
}

export async function releaseRegistrationQuotaHoldInTransaction(
  transaction: Transaction,
  childId: string,
  reason: HoldReleaseReason,
  paymentId: string | null,
) {
  await lockChild(transaction, childId);
  await lockHold(transaction, childId);
  const hold = await transaction.holdKuotaPendaftaran.findUnique({
    where: { calonMuridId: childId },
  });
  if (!hold || hold.status !== StatusHoldKuota.PENDING_PAYMENT) return hold;

  const nextStatus =
    reason === "EXPIRED"
      ? StatusHoldKuota.EXPIRED
      : StatusHoldKuota.CANCELLED;
  const released = await transaction.holdKuotaPendaftaran.update({
    where: { id: hold.id },
    data: { status: nextStatus, releasedAt: new Date() },
  });
  await transaction.calonMurid.updateMany({
    where: {
      id: childId,
      statusKeseluruhan: StatusKeseluruhan.MENUNGGU_VERIFIKASI_BAYAR,
    },
    data: { statusKeseluruhan: StatusKeseluruhan.PILIH_JALUR },
  });
  await transaction.auditLog.create({
    data: {
      actorId: null,
      action: "RELEASE_REGISTRATION_QUOTA_HOLD",
      entity: "hold_kuota_pendaftaran",
      entityId: hold.id,
      detail: {
        calonMuridId: childId,
        paymentId,
        jalurId: hold.jalurId,
        kategoriId: hold.kategoriId,
        reason,
        before: hold.status,
        after: released.status,
      },
    },
  });
  return released;
}

async function expireHoldBatch(limit: number) {
  const now = new Date();
  const rows = await prisma.holdKuotaPendaftaran.findMany({
    where: {
      status: StatusHoldKuota.PENDING_PAYMENT,
      expiresAt: { lte: now },
    },
    orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
    take: limit,
    select: { id: true, calonMuridId: true },
  });
  let expired = 0;
  for (const row of rows) {
    const processed = await prisma.$transaction(async (transaction) => {
      await lockChild(transaction, row.calonMuridId);
      await lockHold(transaction, row.calonMuridId);
      const hold = await transaction.holdKuotaPendaftaran.findUnique({
        where: { id: row.id },
      });
      if (
        !hold ||
        hold.status !== StatusHoldKuota.PENDING_PAYMENT ||
        hold.expiresAt > new Date()
      ) {
        return false;
      }
      await transaction.holdKuotaPendaftaran.update({
        where: { id: row.id },
        data: {
          status: StatusHoldKuota.EXPIRED,
          releasedAt: new Date(),
        },
      });
      await transaction.pembayaran.updateMany({
        where: {
          calonMuridReference: row.calonMuridId,
          jenis: JenisPembayaran.PENDAFTARAN,
          status: StatusPembayaran.PENDING,
        },
        data: {
          status: StatusPembayaran.REJECTED,
          catatanAdmin: "Hold kuota pembayaran berakhir otomatis.",
          verifiedAt: null,
          verifiedById: null,
        },
      });
      await transaction.calonMurid.updateMany({
        where: {
          id: row.calonMuridId,
          statusKeseluruhan:
            StatusKeseluruhan.MENUNGGU_VERIFIKASI_BAYAR,
        },
        data: { statusKeseluruhan: StatusKeseluruhan.PILIH_JALUR },
      });
      await transaction.auditLog.create({
        data: {
          actorId: null,
          action: "EXPIRE_REGISTRATION_QUOTA_HOLD",
          entity: "hold_kuota_pendaftaran",
          entityId: row.id,
          detail: {
            calonMuridId: row.calonMuridId,
            source: "SCHEDULED_CLEANUP",
          },
        },
      });
      return true;
    });
    if (processed) expired += 1;
  }
  return { candidates: rows.length, expired };
}

export async function expireRegistrationQuotaHolds() {
  const batchSize = 100;
  let expired = 0;
  for (let batch = 0; batch < 10; batch += 1) {
    const result = await expireHoldBatch(batchSize);
    expired += result.expired;
    if (result.candidates < batchSize) break;
  }
  return { expired };
}
