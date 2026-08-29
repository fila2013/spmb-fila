import "server-only";

import type { Jalur, KategoriPendaftar } from "@/generated/prisma/client";
import { MasterDataError } from "@/lib/master-data/errors";
import type {
  CreateBiayaInput,
  CreateJalurInput,
  CreateKategoriInput,
  UpdateBiayaInput,
  UpdateJalurInput,
  UpdateKategoriInput,
} from "@/lib/master-data/schemas";
import {
  assertFallbackIsNotSelf,
  assertQuotaCanBeSet,
} from "@/lib/master-data/rules";
import { prisma } from "@/lib/prisma";

function isoDate(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}

function jalurSnapshot(jalur: Jalur) {
  return {
    nama: jalur.nama,
    statusAktif: jalur.statusAktif,
    periodeMulai: isoDate(jalur.periodeMulai),
    periodeSelesai: isoDate(jalur.periodeSelesai),
    kuotaMaks: jalur.kuotaMaks,
    kuotaTerpakai: jalur.kuotaTerpakai,
    fallbackJalurId: jalur.fallbackJalurId,
    hapusDataJikaGagal: jalur.hapusDataJikaGagal,
  };
}

function kategoriSnapshot(kategori: KategoriPendaftar) {
  return {
    nama: kategori.nama,
    tipe: kategori.tipe,
    statusAktif: kategori.statusAktif,
    periodeMulai: isoDate(kategori.periodeMulai),
    periodeSelesai: isoDate(kategori.periodeSelesai),
    kuotaMaks: kategori.kuotaMaks,
    kuotaTerpakai: kategori.kuotaTerpakai,
  };
}

function rethrowKnownDatabaseError(error: unknown): never {
  if ((error as { code?: string }).code === "P2002") {
    throw new MasterDataError(
      "CONFLICT",
      "Data dengan kombinasi atau nama tersebut sudah ada.",
      409,
    );
  }

  throw error;
}

async function assertFallbackExists(fallbackJalurId: string | null) {
  if (!fallbackJalurId) return;
  const fallback = await prisma.jalur.findUnique({
    where: { id: fallbackJalurId },
    select: { id: true },
  });
  if (!fallback) {
    throw new MasterDataError(
      "INVALID_FALLBACK",
      "Jalur fallback tidak ditemukan.",
      422,
    );
  }
}

export function listJalur() {
  return prisma.jalur.findMany({
    orderBy: [{ createdAt: "asc" }, { nama: "asc" }],
    include: { fallbackJalur: { select: { id: true, nama: true } } },
  });
}

export async function createJalur(input: CreateJalurInput, actorId: string) {
  await assertFallbackExists(input.fallbackJalurId);

  try {
    return await prisma.$transaction(async (transaction) => {
      const jalur = await transaction.jalur.create({ data: input });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "CREATE_JALUR",
          entity: "jalur",
          entityId: jalur.id,
          detail: { after: jalurSnapshot(jalur) },
        },
      });
      return jalur;
    });
  } catch (error) {
    rethrowKnownDatabaseError(error);
  }
}

export async function updateJalur(input: UpdateJalurInput, actorId: string) {
  assertFallbackIsNotSelf(input.id, input.fallbackJalurId);
  await assertFallbackExists(input.fallbackJalurId);

  try {
    return await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT id FROM "jalur" WHERE id = ${input.id}::uuid FOR UPDATE
      `;
      const previous = await transaction.jalur.findUnique({
        where: { id: input.id },
      });
      if (!previous) {
        throw new MasterDataError("NOT_FOUND", "Jalur tidak ditemukan.", 404);
      }
      assertQuotaCanBeSet(input.kuotaMaks, previous.kuotaTerpakai);
      if (input.fallbackJalurId) {
        const cycle = await transaction.$queryRaw<Array<{ id: string }>>`
          WITH RECURSIVE fallback_chain AS (
            SELECT id, fallback_jalur_id
            FROM "jalur"
            WHERE id = ${input.fallbackJalurId}::uuid
            UNION
            SELECT j.id, j.fallback_jalur_id
            FROM "jalur" j
            INNER JOIN fallback_chain chain ON j.id = chain.fallback_jalur_id
          )
          SELECT id FROM fallback_chain WHERE id = ${input.id}::uuid LIMIT 1
        `;
        if (cycle.length) {
          throw new MasterDataError(
            "INVALID_FALLBACK",
            "Fallback membentuk siklus antar-jalur.",
            422,
          );
        }
      }

      const { id, ...data } = input;
      const jalur = await transaction.jalur.update({ where: { id }, data });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "UPDATE_JALUR",
          entity: "jalur",
          entityId: jalur.id,
          detail: {
            before: jalurSnapshot(previous),
            after: jalurSnapshot(jalur),
          },
        },
      });
      return jalur;
    });
  } catch (error) {
    if (error instanceof MasterDataError) throw error;
    rethrowKnownDatabaseError(error);
  }
}

export function listKategori() {
  return prisma.kategoriPendaftar.findMany({
    orderBy: [{ createdAt: "asc" }, { nama: "asc" }],
  });
}

export async function createKategori(
  input: CreateKategoriInput,
  actorId: string,
) {
  try {
    return await prisma.$transaction(async (transaction) => {
      const kategori = await transaction.kategoriPendaftar.create({ data: input });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "CREATE_KATEGORI",
          entity: "kategori_pendaftar",
          entityId: kategori.id,
          detail: { after: kategoriSnapshot(kategori) },
        },
      });
      return kategori;
    });
  } catch (error) {
    rethrowKnownDatabaseError(error);
  }
}

export async function updateKategori(
  input: UpdateKategoriInput,
  actorId: string,
) {
  try {
    return await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT id FROM "kategori_pendaftar" WHERE id = ${input.id}::uuid FOR UPDATE
      `;
      const previous = await transaction.kategoriPendaftar.findUnique({
        where: { id: input.id },
      });
      if (!previous) {
        throw new MasterDataError("NOT_FOUND", "Kategori tidak ditemukan.", 404);
      }
      assertQuotaCanBeSet(input.kuotaMaks, previous.kuotaTerpakai);
      if (input.tipe !== previous.tipe) {
        const usage = await transaction.calonMurid.count({
          where: { kategoriId: input.id },
        });
        if (usage > 0) {
          throw new MasterDataError(
            "CONFLICT",
            "Tipe kategori tidak dapat diubah karena sudah digunakan calon murid.",
            409,
          );
        }
      }

      const { id, ...data } = input;
      const kategori = await transaction.kategoriPendaftar.update({
        where: { id },
        data,
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "UPDATE_KATEGORI",
          entity: "kategori_pendaftar",
          entityId: kategori.id,
          detail: {
            before: kategoriSnapshot(previous),
            after: kategoriSnapshot(kategori),
          },
        },
      });
      return kategori;
    });
  } catch (error) {
    if (error instanceof MasterDataError) throw error;
    rethrowKnownDatabaseError(error);
  }
}

export async function listBiayaMatrix() {
  const [jalur, kategori, biaya] = await Promise.all([
    listJalur(),
    listKategori(),
    prisma.biayaPendaftaran.findMany(),
  ]);
  const biayaByCombination = new Map(
    biaya.map((item) => [`${item.jalurId}:${item.kategoriId}`, item]),
  );

  return jalur.flatMap((itemJalur) =>
    kategori.map((itemKategori) => ({
      jalur: itemJalur,
      kategori: itemKategori,
      biaya:
        biayaByCombination.get(`${itemJalur.id}:${itemKategori.id}`) ?? null,
    })),
  );
}

export async function createBiaya(input: CreateBiayaInput, actorId: string) {
  const [jalur, kategori] = await Promise.all([
    prisma.jalur.findUnique({ where: { id: input.jalurId }, select: { id: true } }),
    prisma.kategoriPendaftar.findUnique({
      where: { id: input.kategoriId },
      select: { id: true },
    }),
  ]);
  if (!jalur || !kategori) {
    throw new MasterDataError(
      "NOT_FOUND",
      "Jalur atau kategori tidak ditemukan.",
      404,
    );
  }

  try {
    return await prisma.$transaction(async (transaction) => {
      const biaya = await transaction.biayaPendaftaran.create({ data: input });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "CREATE_BIAYA_PENDAFTARAN",
          entity: "biaya_pendaftaran",
          entityId: biaya.id,
          detail: {
            after: {
              jalurId: biaya.jalurId,
              kategoriId: biaya.kategoriId,
              nominal: biaya.nominal,
              statusAktif: biaya.statusAktif,
            },
          },
        },
      });
      return biaya;
    });
  } catch (error) {
    rethrowKnownDatabaseError(error);
  }
}

export async function updateBiaya(input: UpdateBiayaInput, actorId: string) {
  return prisma.$transaction(async (transaction) => {
    const previous = await transaction.biayaPendaftaran.findUnique({
      where: { id: input.id },
    });
    if (!previous) {
      throw new MasterDataError("NOT_FOUND", "Biaya tidak ditemukan.", 404);
    }

    const biaya = await transaction.biayaPendaftaran.update({
      where: { id: input.id },
      data: { nominal: input.nominal, statusAktif: input.statusAktif },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "UPDATE_BIAYA_PENDAFTARAN",
        entity: "biaya_pendaftaran",
        entityId: biaya.id,
        detail: {
          before: {
            nominal: previous.nominal,
            statusAktif: previous.statusAktif,
          },
          after: { nominal: biaya.nominal, statusAktif: biaya.statusAktif },
        },
      },
    });
    return biaya;
  });
}
