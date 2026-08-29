import "server-only";

import type { KontenTahap, Prisma } from "@/generated/prisma/client";
import {
  StatusAssessment,
  StatusKeseluruhan,
  TahapKonten,
} from "@/generated/prisma/enums";
import { assertOwnership } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { StageError } from "@/lib/stages/errors";
import {
  assertAnnouncementDecisionSupported,
  dateOnly,
  isAnnouncementReleased,
  mayViewAnnouncement,
  mayViewAssessment,
  releasedOverallStatus,
} from "@/lib/stages/rules";
import type {
  AnnouncementInput,
  AssessmentInput,
  StageContentInput,
  UpdateStageContentInput,
} from "@/lib/stages/schemas";

type Transaction = Prisma.TransactionClient;

const contentInclude = {
  jalur: { select: { id: true, nama: true } },
  kategori: { select: { id: true, nama: true } },
} satisfies Prisma.KontenTahapInclude;

function contentSnapshot(content: KontenTahap) {
  return {
    tahap: content.tahap,
    judul: content.judul,
    tanggal: dateOnly(content.tanggal),
    isiTeks: content.isiTeks,
    gambarUrl: content.gambarUrl,
    urutanLayout: content.urutanLayout,
    statusAktif: content.statusAktif,
    jalurId: content.jalurId,
    kategoriId: content.kategoriId,
  };
}

function contentData(input: StageContentInput) {
  return {
    ...input,
    tanggal: input.tanggal ? new Date(`${input.tanggal}T00:00:00.000Z`) : null,
  };
}

async function assertContentReferences(jalurId: string | null, kategoriId: string | null) {
  const [jalur, kategori] = await Promise.all([
    jalurId ? prisma.jalur.findUnique({ where: { id: jalurId }, select: { id: true } }) : true,
    kategoriId ? prisma.kategoriPendaftar.findUnique({ where: { id: kategoriId }, select: { id: true } }) : true,
  ]);
  if (!jalur || !kategori) throw new StageError("REFERENCE_NOT_FOUND", "Jalur atau kategori konten tidak ditemukan.", 422);
}

export function listStageContent(tahap?: TahapKonten) {
  return prisma.kontenTahap.findMany({
    where: tahap ? { tahap } : undefined,
    include: contentInclude,
    orderBy: [{ tahap: "asc" }, { urutanLayout: "asc" }, { createdAt: "asc" }],
  });
}

export async function createStageContent(input: StageContentInput, actorId: string) {
  await assertContentReferences(input.jalurId, input.kategoriId);
  return prisma.$transaction(async (transaction) => {
    const content = await transaction.kontenTahap.create({ data: contentData(input), include: contentInclude });
    await transaction.auditLog.create({ data: { actorId, action: "CREATE_STAGE_CONTENT", entity: "konten_tahap", entityId: content.id, detail: { after: contentSnapshot(content) } } });
    return content;
  });
}

export async function updateStageContent(input: UpdateStageContentInput, actorId: string) {
  await assertContentReferences(input.jalurId, input.kategoriId);
  return prisma.$transaction(async (transaction) => {
    const previous = await transaction.kontenTahap.findUnique({ where: { id: input.id } });
    if (!previous) throw new StageError("NOT_FOUND", "Konten tahap tidak ditemukan.", 404);
    const { id, ...values } = input;
    const content = await transaction.kontenTahap.update({ where: { id }, data: contentData(values), include: contentInclude });
    await transaction.auditLog.create({ data: { actorId, action: "UPDATE_STAGE_CONTENT", entity: "konten_tahap", entityId: content.id, detail: { before: contentSnapshot(previous), after: contentSnapshot(content) } } });
    return content;
  });
}

export async function uploadStageImage(file: File) {
  if (file.size === 0) return null;
  if (file.size > 5 * 1024 * 1024) throw new StageError("IMAGE_TOO_LARGE", "Gambar maksimal 5 MB.", 422);
  const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  const extension = extensions[file.type];
  if (!extension) throw new StageError("INVALID_IMAGE", "Gambar harus berformat JPG, PNG, atau WebP.", 422);
  const bucket = process.env.SUPABASE_STORAGE_BUCKET_CMS;
  if (!bucket) throw new StageError("STORAGE_NOT_CONFIGURED", "Bucket konten CMS belum dikonfigurasi.", 503);
  const path = `phase-7/${crypto.randomUUID()}.${extension}`;
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new StageError("UPLOAD_FAILED", "Gambar belum dapat diunggah.", 502);
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

async function getOwnedStageChild(childId: string, userId: string) {
  const child = await prisma.calonMurid.findUnique({
    where: { id: childId },
    include: {
      jalur: { select: { id: true, nama: true } },
      kategori: { select: { id: true, nama: true } },
      hasilAssessment: true,
      pengumuman: true,
    },
  });
  if (!child) throw new StageError("NOT_FOUND", "Data calon murid tidak ditemukan.", 404);
  assertOwnership({ userId, role: "WALI_MURID" }, child.userId);
  return child;
}

function matchingContentWhere(tahap: TahapKonten, child: { jalurId: string | null; kategoriId: string | null }) {
  return {
    tahap,
    statusAktif: true,
    AND: [
      { OR: [{ jalurId: null }, { jalurId: child.jalurId ?? "00000000-0000-0000-0000-000000000000" }] },
      { OR: [{ kategoriId: null }, { kategoriId: child.kategoriId ?? "00000000-0000-0000-0000-000000000000" }] },
    ],
  } satisfies Prisma.KontenTahapWhereInput;
}

function publicContent(content: KontenTahap) {
  return { id: content.id, judul: content.judul, tanggal: dateOnly(content.tanggal), isiTeks: content.isiTeks, gambarUrl: content.gambarUrl, urutanLayout: content.urutanLayout };
}

export async function getAssessmentForWali(childId: string, userId: string) {
  const child = await getOwnedStageChild(childId, userId);
  if (!mayViewAssessment(child.statusKeseluruhan)) throw new StageError("STAGE_FORBIDDEN", "Tahap assessment belum dapat diakses.", 403);
  const content = await prisma.kontenTahap.findMany({ where: matchingContentWhere(TahapKonten.ASSESSMENT, child), orderBy: [{ urutanLayout: "asc" }, { createdAt: "asc" }] });
  return {
    child: { id: child.id, namaAnak: child.namaAnak, jalur: child.jalur?.nama ?? null, kategori: child.kategori?.nama ?? null, statusKeseluruhan: child.statusKeseluruhan },
    assessment: { status: child.hasilAssessment?.status ?? StatusAssessment.BELUM },
    content: content.map(publicContent),
  };
}

async function synchronizeReleasedAnnouncement(transaction: Transaction, childId: string) {
  const announcement = await transaction.pengumuman.findUnique({ where: { calonMuridId: childId } });
  if (!announcement?.statusAkhir || !isAnnouncementReleased(announcement.tanggalRilis)) return announcement;
  const nextStatus = releasedOverallStatus(announcement.statusAkhir);
  const child = await transaction.calonMurid.findUnique({ where: { id: childId }, select: { statusKeseluruhan: true } });
  if (child?.statusKeseluruhan === StatusKeseluruhan.MENUNGGU_PENGUMUMAN) {
    await transaction.calonMurid.update({ where: { id: childId }, data: { statusKeseluruhan: nextStatus } });
    await transaction.auditLog.create({ data: { action: "RELEASE_ANNOUNCEMENT", entity: "calon_murid", entityId: childId, detail: { statusAkhir: announcement.statusAkhir, tanggalRilis: dateOnly(announcement.tanggalRilis), nextStatus } } });
  }
  return announcement;
}

export async function getAnnouncementForWali(childId: string, userId: string) {
  const owned = await getOwnedStageChild(childId, userId);
  if (!mayViewAnnouncement(owned.statusKeseluruhan)) throw new StageError("STAGE_FORBIDDEN", "Tahap pengumuman belum dapat diakses.", 403);
  const announcement = await prisma.$transaction((transaction) => synchronizeReleasedAnnouncement(transaction, childId));
  const released = Boolean(announcement?.statusAkhir && isAnnouncementReleased(announcement.tanggalRilis));
  const content = released ? await prisma.kontenTahap.findMany({ where: matchingContentWhere(TahapKonten.ANNOUNCEMENT, owned), orderBy: [{ urutanLayout: "asc" }, { createdAt: "asc" }] }) : [];
  return {
    child: { id: owned.id, namaAnak: owned.namaAnak, jalur: owned.jalur?.nama ?? null, kategori: owned.kategori?.nama ?? null },
    released,
    tanggalRilis: dateOnly(announcement?.tanggalRilis ?? null),
    statusAkhir: released ? announcement?.statusAkhir ?? null : null,
    content: content.map(publicContent),
  };
}

export function listParticipants(query?: string) {
  return prisma.calonMurid.findMany({
    where: query ? { OR: [{ namaAnak: { contains: query, mode: "insensitive" } }, { user: { email: { contains: query, mode: "insensitive" } } }] } : undefined,
    include: { user: { select: { email: true } }, jalur: { select: { nama: true } }, kategori: { select: { nama: true } }, hasilAssessment: true, pengumuman: true },
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function getParticipant(childId: string) {
  const participant = await prisma.calonMurid.findUnique({
    where: { id: childId },
    include: {
      user: { select: { email: true } },
      jalur: true,
      kategori: true,
      hasilAssessment: true,
      pengumuman: true,
      pembayaran: { orderBy: { createdAt: "desc" } },
      formResponses: { include: { field: true }, orderBy: { field: { urutan: "asc" } } },
    },
  });
  if (!participant) throw new StageError("NOT_FOUND", "Peserta tidak ditemukan.", 404);
  return participant;
}

export async function updateAssessment(childId: string, input: AssessmentInput, actorId: string) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM "calon_murid" WHERE id = ${childId}::uuid FOR UPDATE`;
    const child = await transaction.calonMurid.findUnique({ where: { id: childId }, include: { hasilAssessment: true, pengumuman: true } });
    if (!child) throw new StageError("NOT_FOUND", "Peserta tidak ditemukan.", 404);
    const assessmentStages: StatusKeseluruhan[] = [StatusKeseluruhan.MENUNGGU_ASESMEN, StatusKeseluruhan.MENUNGGU_PENGUMUMAN];
    if (!assessmentStages.includes(child.statusKeseluruhan)) throw new StageError("INVALID_STAGE", "Peserta tidak berada pada tahap assessment.", 409);
    if (input.status === StatusAssessment.BELUM && child.pengumuman?.statusAkhir) throw new StageError("ANNOUNCEMENT_EXISTS", "Assessment tidak dapat direset setelah hasil pengumuman diisi.", 409);
    const result = await transaction.hasilAssessment.upsert({ where: { calonMuridId: childId }, update: input, create: { calonMuridId: childId, ...input } });
    const nextStatus = input.status === StatusAssessment.BELUM ? StatusKeseluruhan.MENUNGGU_ASESMEN : StatusKeseluruhan.MENUNGGU_PENGUMUMAN;
    await transaction.calonMurid.update({ where: { id: childId }, data: { statusKeseluruhan: nextStatus } });
    await transaction.auditLog.create({ data: { actorId, action: "UPDATE_ASSESSMENT_RESULT", entity: "hasil_assessment", entityId: childId, detail: { before: child.hasilAssessment ? { status: child.hasilAssessment.status, catatan: child.hasilAssessment.catatan } : null, after: { status: result.status, catatan: result.catatan }, nextStatus } } });
    return result;
  });
}

export async function updateAnnouncement(childId: string, input: AnnouncementInput, actorId: string) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM "calon_murid" WHERE id = ${childId}::uuid FOR UPDATE`;
    const child = await transaction.calonMurid.findUnique({ where: { id: childId }, include: { jalur: true, hasilAssessment: true, pengumuman: true } });
    if (!child?.jalur) throw new StageError("NOT_FOUND", "Peserta atau jalur tidak ditemukan.", 404);
    if (!child.hasilAssessment || child.hasilAssessment.status === StatusAssessment.BELUM) throw new StageError("ASSESSMENT_REQUIRED", "Hasil assessment harus diisi terlebih dahulu.", 409);
    assertAnnouncementDecisionSupported(input.statusAkhir, child.jalur);
    const tanggalRilis = new Date(`${input.tanggalRilis}T00:00:00.000Z`);
    const released = isAnnouncementReleased(tanggalRilis);
    const nextStatus = released ? releasedOverallStatus(input.statusAkhir) : StatusKeseluruhan.MENUNGGU_PENGUMUMAN;
    const result = await transaction.pengumuman.upsert({ where: { calonMuridId: childId }, update: { ...input, tanggalRilis, updatedById: actorId }, create: { calonMuridId: childId, ...input, tanggalRilis, updatedById: actorId } });
    await transaction.calonMurid.update({ where: { id: childId }, data: { statusKeseluruhan: nextStatus } });
    await transaction.auditLog.create({ data: { actorId, action: "UPDATE_ANNOUNCEMENT_RESULT", entity: "pengumuman", entityId: childId, detail: { before: child.pengumuman ? { statusAkhir: child.pengumuman.statusAkhir, tanggalRilis: dateOnly(child.pengumuman.tanggalRilis) } : null, after: { statusAkhir: result.statusAkhir, tanggalRilis: dateOnly(result.tanggalRilis) }, released, nextStatus } } });
    return { ...result, released, nextStatus };
  });
}
