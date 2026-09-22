import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  StatusHoldKuota,
  StatusKeseluruhan,
} from "@/generated/prisma/enums";
import { assertOwnership } from "@/lib/auth/authorization";
import { CalonMuridError } from "@/lib/calon-murid/errors";
import {
  assertSelectionAvailable,
  normalizedSubKategori,
  selectionAvailability,
} from "@/lib/calon-murid/rules";
import type {
  CreateCalonMuridInput,
  CreateCalonMuridWithJalurInput,
  SelectJalurInput,
  SelectKategoriInput,
} from "@/lib/calon-murid/schemas";
import { prisma } from "@/lib/prisma";
import {
  activeCategoryHoldCounts,
  activeRouteHoldCounts,
  countActiveRouteHoldsInTransaction,
  reserveRegistrationQuotaInTransaction,
} from "@/lib/quota-hold/service";

type Transaction = Prisma.TransactionClient;

const detailInclude = {
  jalur: true,
  jalurAsal: true,
  menungguFallbackJalur: true,
  kategori: true,
} satisfies Prisma.CalonMuridInclude;

function childSnapshot(child: {
  namaAnak: string;
  jalurId: string | null;
  kategoriId: string | null;
  subKategoriEnum: string | null;
  subKategoriText: string | null;
  statusKeseluruhan: string;
}) {
  return {
    namaAnak: child.namaAnak,
    jalurId: child.jalurId,
    kategoriId: child.kategoriId,
    subKategoriEnum: child.subKategoriEnum,
    subKategoriText: child.subKategoriText,
    statusKeseluruhan: child.statusKeseluruhan,
  };
}

async function lockChild(transaction: Transaction, id: string, userId: string) {
  await transaction.$queryRaw`
    SELECT id FROM "calon_murid" WHERE id = ${id}::uuid FOR UPDATE
  `;
  const child = await transaction.calonMurid.findUnique({ where: { id } });
  if (!child) {
    throw new CalonMuridError(
      "NOT_FOUND",
      "Data calon murid tidak ditemukan.",
      404,
    );
  }
  assertOwnership({ userId, role: "WALI_MURID" }, child.userId);
  return child;
}

async function lockRoutes(transaction: Transaction, ids: Array<string | null>) {
  for (const id of [...new Set(ids.filter((value): value is string => Boolean(value)))].sort()) {
    await transaction.$queryRaw`
      SELECT id FROM "jalur" WHERE id = ${id}::uuid FOR UPDATE
    `;
  }
}

async function lockCategories(
  transaction: Transaction,
  ids: Array<string | null>,
) {
  for (const id of [...new Set(ids.filter((value): value is string => Boolean(value)))].sort()) {
    await transaction.$queryRaw`
      SELECT id FROM "kategori_pendaftar" WHERE id = ${id}::uuid FOR UPDATE
    `;
  }
}

async function assertSelectionMutable(
  transaction: Transaction,
  child: { id: string; statusKeseluruhan: StatusKeseluruhan },
) {
  if (child.statusKeseluruhan === StatusKeseluruhan.PILIH_JALUR) return;
  if (
    child.statusKeseluruhan ===
    StatusKeseluruhan.MENUNGGU_VERIFIKASI_BAYAR
  ) {
    const activeHold = await transaction.holdKuotaPendaftaran.count({
      where: {
        calonMuridId: child.id,
        status: StatusHoldKuota.PENDING_PAYMENT,
        expiresAt: { gt: new Date() },
      },
    });
    if (activeHold === 0) return;
  }
  throw new CalonMuridError(
    "INVALID_STAGE",
    "Pilihan tidak dapat diubah pada tahap pendaftaran saat ini.",
    409,
  );
}

async function activeFee(
  transaction: Transaction,
  jalurId: string,
  kategoriId: string,
) {
  return transaction.biayaPendaftaran.findFirst({
    where: { jalurId, kategoriId, statusAktif: true },
  });
}

export function listOwnedCalonMurid(userId: string) {
  return prisma.calonMurid.findMany({
    where: { userId },
    include: detailInclude,
    orderBy: [{ createdAt: "asc" }, { namaAnak: "asc" }],
  });
}

export async function getOwnedCalonMurid(id: string, userId: string) {
  const child = await prisma.calonMurid.findUnique({
    where: { id },
    include: detailInclude,
  });
  if (!child) {
    throw new CalonMuridError(
      "NOT_FOUND",
      "Data calon murid tidak ditemukan.",
      404,
    );
  }
  assertOwnership({ userId, role: "WALI_MURID" }, child.userId);
  return child;
}

export async function createCalonMurid(
  input: CreateCalonMuridInput,
  userId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const child = await transaction.calonMurid.create({
      data: { userId, namaAnak: input.namaAnak },
    });
    await transaction.auditLog.create({
      data: {
        actorId: userId,
        action: "CREATE_CALON_MURID_DRAFT",
        entity: "calon_murid",
        entityId: child.id,
        detail: { after: childSnapshot(child) },
      },
    });
    return child;
  });
}

export async function createCalonMuridWithJalur(
  input: CreateCalonMuridWithJalurInput,
  userId: string,
) {
  return prisma.$transaction(async (transaction) => {
    await lockRoutes(transaction, [input.jalurId]);
    const route = await transaction.jalur.findUnique({
      where: { id: input.jalurId },
    });
    if (!route) {
      throw new CalonMuridError("NOT_FOUND", "Jalur tidak ditemukan.", 404);
    }
    const activeHolds = await countActiveRouteHoldsInTransaction(
      transaction,
      route.id,
    );
    assertSelectionAvailable({ ...route, kuotaDitahan: activeHolds });

    const child = await transaction.calonMurid.create({
      data: {
        userId,
        namaAnak: input.namaAnak,
        jalurId: input.jalurId,
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId: userId,
        action: "CREATE_CALON_MURID_WITH_JALUR",
        entity: "calon_murid",
        entityId: child.id,
        detail: { after: childSnapshot(child) },
      },
    });
    return child;
  });
}

export async function selectJalur(
  id: string,
  input: SelectJalurInput,
  userId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const previous = await lockChild(transaction, id, userId);
    await assertSelectionMutable(transaction, previous);
    if (previous.jalurId === input.jalurId) return previous;

    await lockRoutes(transaction, [previous.jalurId, input.jalurId]);
    const route = await transaction.jalur.findUnique({
      where: { id: input.jalurId },
    });
    if (!route) {
      throw new CalonMuridError("NOT_FOUND", "Jalur tidak ditemukan.", 404);
    }
    const activeHolds = await countActiveRouteHoldsInTransaction(
      transaction,
      route.id,
      new Date(),
      previous.id,
    );
    assertSelectionAvailable({ ...route, kuotaDitahan: activeHolds });

    if (previous.kategoriId) {
      const fee = await activeFee(
        transaction,
        route.id,
        previous.kategoriId,
      );
      if (!fee) {
        throw new CalonMuridError(
          "FEE_NOT_CONFIGURED",
          "Biaya untuk kombinasi jalur dan kategori ini belum diatur.",
          422,
        );
      }
    }

    const child = await transaction.calonMurid.update({
      where: { id },
      data: { jalurId: route.id },
    });
    await transaction.auditLog.create({
      data: {
        actorId: userId,
        action: "SELECT_JALUR",
        entity: "calon_murid",
        entityId: id,
        detail: {
          before: childSnapshot(previous),
          after: childSnapshot(child),
        },
      },
    });
    return child;
  });
}

export async function selectKategori(
  id: string,
  input: SelectKategoriInput,
  userId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const previous = await lockChild(transaction, id, userId);
    await assertSelectionMutable(transaction, previous);
    if (!previous.jalurId) {
      throw new CalonMuridError(
        "INVALID_STAGE",
        "Pilih jalur sebelum memilih kategori.",
        409,
      );
    }

    await lockRoutes(transaction, [previous.jalurId]);
    await lockCategories(transaction, [previous.kategoriId, input.kategoriId]);
    const category = await transaction.kategoriPendaftar.findUnique({
      where: { id: input.kategoriId },
    });
    if (!category) {
      throw new CalonMuridError("NOT_FOUND", "Kategori tidak ditemukan.", 404);
    }
    const route = await transaction.jalur.findUnique({
      where: { id: previous.jalurId },
    });
    if (!route) {
      throw new CalonMuridError("NOT_FOUND", "Jalur tidak ditemukan.", 404);
    }
    assertSelectionAvailable({ ...route, kuotaMaks: null });
    assertSelectionAvailable({ ...category, kuotaMaks: null });
    const subCategory = normalizedSubKategori(category.tipe, input);
    const fee = await activeFee(transaction, previous.jalurId, category.id);
    if (!fee) {
      throw new CalonMuridError(
        "FEE_NOT_CONFIGURED",
        "Biaya untuk kombinasi jalur dan kategori ini belum diatur.",
        422,
      );
    }

    const child = await transaction.calonMurid.update({
      where: { id },
      data: {
        kategoriId: category.id,
        ...subCategory,
        statusKeseluruhan:
          StatusKeseluruhan.MENUNGGU_VERIFIKASI_BAYAR,
      },
    });
    await reserveRegistrationQuotaInTransaction(
      transaction,
      {
        id: child.id,
        jalurId: previous.jalurId,
        kategoriId: category.id,
      },
      userId,
    );
    await transaction.auditLog.create({
      data: {
        actorId: userId,
        action: "SELECT_KATEGORI",
        entity: "calon_murid",
        entityId: id,
        detail: {
          before: childSnapshot(previous),
          after: childSnapshot(child),
          biayaPendaftaranId: fee.id,
          nominal: fee.nominal,
        },
      },
    });
    return child;
  });
}

export async function listSelectableJalur() {
  const [routes, holdCounts] = await Promise.all([
    prisma.jalur.findMany({
      orderBy: [{ createdAt: "asc" }, { nama: "asc" }],
    }),
    activeRouteHoldCounts(),
  ]);
  return routes.map((route) => ({
    ...route,
    kuotaDitahan: holdCounts.get(route.id) ?? 0,
    availability: selectionAvailability({
      ...route,
      kuotaDitahan: holdCounts.get(route.id) ?? 0,
    }),
  }));
}

export async function listSelectableKategori(jalurId: string) {
  const [categories, holdCounts] = await Promise.all([
    prisma.kategoriPendaftar.findMany({
      include: {
        biayaPendaftaran: {
          where: { jalurId, statusAktif: true },
          take: 1,
        },
      },
      orderBy: [{ createdAt: "asc" }, { nama: "asc" }],
    }),
    activeCategoryHoldCounts(),
  ]);
  return categories.map((category) => ({
    ...category,
    kuotaDitahan: holdCounts.get(category.id) ?? 0,
    fee: category.biayaPendaftaran[0] ?? null,
    availability: selectionAvailability({
      ...category,
      kuotaDitahan: holdCounts.get(category.id) ?? 0,
    }),
  }));
}

export async function getPaymentPreparation(id: string, userId: string) {
  const child = await getOwnedCalonMurid(id, userId);
  if (!child.jalurId || !child.kategoriId || !child.jalur || !child.kategori) {
    throw new CalonMuridError(
      "INVALID_STAGE",
      "Pilihan jalur dan kategori belum lengkap.",
      409,
    );
  }
  if (
    child.statusKeseluruhan !==
    StatusKeseluruhan.MENUNGGU_VERIFIKASI_BAYAR
  ) {
    throw new CalonMuridError(
      "INVALID_STAGE",
      "Calon murid belum berada pada tahap pembayaran pendaftaran.",
      409,
    );
  }
  const fee = await prisma.biayaPendaftaran.findFirst({
    where: {
      jalurId: child.jalurId,
      kategoriId: child.kategoriId,
      statusAktif: true,
    },
  });
  if (!fee) {
    throw new CalonMuridError(
      "FEE_NOT_CONFIGURED",
      "Biaya pendaftaran belum diatur oleh admin.",
      422,
    );
  }
  return { child, fee };
}
