import "server-only";

import type { KontenTahap, Prisma } from "@/generated/prisma/client";
import {
  StatusAssessment,
  StatusKeseluruhan,
  StatusPengumuman,
  TahapKonten,
} from "@/generated/prisma/enums";
import { assertOwnership } from "@/lib/auth/authorization";
import { FallbackError } from "@/lib/fallback/errors";
import { handleRejectedDecisionInTransaction } from "@/lib/fallback/service";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { StageError } from "@/lib/stages/errors";
import {
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
    youtubeVideoId: content.youtubeVideoId,
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

function assertContentScope(input: StageContentInput) {
  if (
    input.tahap === TahapKonten.HOME &&
    (input.jalurId !== null || input.kategoriId !== null)
  ) {
    throw new StageError(
      "INVALID_HOME_SCOPE",
      "Konten beranda harus ditampilkan untuk semua jalur dan kategori.",
      422,
    );
  }
  if (input.tahap !== TahapKonten.HOME && input.youtubeVideoId !== null) {
    throw new StageError(
      "INVALID_VIDEO_SCOPE",
      "Video YouTube hanya dapat digunakan pada konten beranda.",
      422,
    );
  }
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
  assertContentScope(input);
  await assertContentReferences(input.jalurId, input.kategoriId);
  return prisma.$transaction(async (transaction) => {
    const content = await transaction.kontenTahap.create({ data: contentData(input), include: contentInclude });
    await transaction.auditLog.create({ data: { actorId, action: "CREATE_STAGE_CONTENT", entity: "konten_tahap", entityId: content.id, detail: { after: contentSnapshot(content) } } });
    return content;
  });
}

export async function updateStageContent(input: UpdateStageContentInput, actorId: string) {
  assertContentScope(input);
  await assertContentReferences(input.jalurId, input.kategoriId);
  const result = await prisma.$transaction(async (transaction) => {
    const previous = await transaction.kontenTahap.findUnique({ where: { id: input.id } });
    if (!previous) throw new StageError("NOT_FOUND", "Konten tahap tidak ditemukan.", 404);
    const { id, ...values } = input;
    const content = await transaction.kontenTahap.update({ where: { id }, data: contentData(values), include: contentInclude });
    await transaction.auditLog.create({ data: { actorId, action: "UPDATE_STAGE_CONTENT", entity: "konten_tahap", entityId: content.id, detail: { before: contentSnapshot(previous), after: contentSnapshot(content) } } });
    return { content, previousImageUrl: previous.gambarUrl };
  });
  if (
    result.previousImageUrl &&
    result.previousImageUrl !== result.content.gambarUrl
  ) {
    await removeCmsImage(result.previousImageUrl);
  }
  return result.content;
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

function cmsImagePath(publicUrl: string | null) {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET_CMS;
  if (!bucket || !publicUrl) return null;
  try {
    const pathname = decodeURIComponent(new URL(publicUrl).pathname);
    const prefix = `/storage/v1/object/public/${bucket}/`;
    return pathname.startsWith(prefix) ? pathname.slice(prefix.length) : null;
  } catch {
    return null;
  }
}

async function removeCmsImage(publicUrl: string | null) {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET_CMS;
  const path = cmsImagePath(publicUrl);
  if (!bucket || !path) return;
  const { error } = await createAdminClient().storage.from(bucket).remove([path]);
  if (error) {
    console.error("File gambar CMS lama belum dapat dihapus.", {
      name: error.name,
      statusCode: error.statusCode,
    });
  }
}

export async function deleteStageContent(id: string, actorId: string) {
  const content = await prisma.$transaction(async (transaction) => {
    const current = await transaction.kontenTahap.findUnique({ where: { id } });
    if (!current) {
      throw new StageError("NOT_FOUND", "Konten tahap tidak ditemukan.", 404);
    }
    if (current.tahap !== TahapKonten.HOME) {
      throw new StageError(
        "DELETE_NOT_ALLOWED",
        "Penghapusan melalui fitur ini hanya tersedia untuk konten beranda.",
        409,
      );
    }
    await transaction.kontenTahap.delete({ where: { id } });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "DELETE_STAGE_CONTENT",
        entity: "konten_tahap",
        entityId: id,
        detail: { before: contentSnapshot(current) },
      },
    });
    return current;
  });
  await removeCmsImage(content.gambarUrl);
  return { id: content.id, tahap: content.tahap };
}

async function getOwnedStageChild(childId: string, userId: string) {
  const child = await prisma.calonMurid.findUnique({
    where: { id: childId },
    include: {
      jalur: { select: { id: true, nama: true } },
      kategori: { select: { id: true, nama: true } },
      hasilAssessment: true,
      pengumuman: true,
      menungguFallbackJalur: { select: { id: true, nama: true } },
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
  return { id: content.id, judul: content.judul, tanggal: dateOnly(content.tanggal), isiTeks: content.isiTeks, gambarUrl: content.gambarUrl, youtubeVideoId: content.youtubeVideoId, urutanLayout: content.urutanLayout };
}

export async function listHomeContent() {
  const content = await prisma.kontenTahap.findMany({
    where: {
      tahap: TahapKonten.HOME,
      statusAktif: true,
      jalurId: null,
      kategoriId: null,
    },
    orderBy: [{ urutanLayout: "asc" }, { createdAt: "asc" }],
  });
  return content.map(publicContent);
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
  await transaction.$queryRaw`SELECT id FROM "calon_murid" WHERE id = ${childId}::uuid FOR UPDATE`;
  const child = await transaction.calonMurid.findUnique({
    where: { id: childId },
    include: { pengumuman: true, jalur: true },
  });
  const announcement = child?.pengumuman;
  if (!child || !announcement?.statusAkhir || !isAnnouncementReleased(announcement.tanggalRilis)) return;
  if (child.statusKeseluruhan !== StatusKeseluruhan.MENUNGGU_PENGUMUMAN) return;

  if (announcement.statusAkhir === StatusPengumuman.TIDAK_DITERIMA) {
    const effect = await handleRejectedDecisionInTransaction(transaction, childId, null);
    if (effect.type !== "NONE") return;
  }
  const nextStatus = releasedOverallStatus(announcement.statusAkhir);
  await transaction.calonMurid.update({ where: { id: childId }, data: { statusKeseluruhan: nextStatus } });
  await transaction.auditLog.create({ data: { action: "RELEASE_ANNOUNCEMENT", entity: "calon_murid", entityId: childId, detail: { statusAkhir: announcement.statusAkhir, tanggalRilis: dateOnly(announcement.tanggalRilis), nextStatus } } });
}

export async function getAnnouncementForWali(childId: string, userId: string) {
  const owned = await getOwnedStageChild(childId, userId);
  if (!mayViewAnnouncement(owned.statusKeseluruhan)) throw new StageError("STAGE_FORBIDDEN", "Tahap pengumuman belum dapat diakses.", 403);
  await prisma.$transaction(
    (transaction) => synchronizeReleasedAnnouncement(transaction, childId),
    { maxWait: 10_000, timeout: 30_000 },
  );
  const current = await getOwnedStageChild(childId, userId);
  const announcement = current.pengumuman;
  const waitingQuota = current.statusKeseluruhan === StatusKeseluruhan.MENUNGGU_KUOTA_FALLBACK;
  const released = Boolean(announcement?.statusAkhir && isAnnouncementReleased(announcement.tanggalRilis));
  const content = released ? await prisma.kontenTahap.findMany({ where: matchingContentWhere(TahapKonten.ANNOUNCEMENT, current), orderBy: [{ urutanLayout: "asc" }, { createdAt: "asc" }] }) : [];
  return {
    child: { id: current.id, namaAnak: current.namaAnak, jalur: current.jalur?.nama ?? null, kategori: current.kategori?.nama ?? null },
    released,
    waitingQuota,
    fallbackJalur: current.menungguFallbackJalur?.nama ?? null,
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
    if (child.statusKeseluruhan === StatusKeseluruhan.MENUNGGU_KUOTA_FALLBACK) {
      throw new FallbackError(
        "QUEUE_MANAGED_BY_SYSTEM",
        "Peserta yang sedang menunggu kuota dikelola melalui antrian fallback.",
        409,
      );
    }
    if (!child.hasilAssessment || child.hasilAssessment.status === StatusAssessment.BELUM) throw new StageError("ASSESSMENT_REQUIRED", "Hasil assessment harus diisi terlebih dahulu.", 409);
    const tanggalRilis = new Date(`${input.tanggalRilis}T00:00:00.000Z`);
    const released = isAnnouncementReleased(tanggalRilis);
    if (
      input.statusAkhir === StatusPengumuman.TIDAK_DITERIMA &&
      child.jalur.hapusDataJikaGagal &&
      !released
    ) {
      throw new FallbackError(
        "AUTO_DELETE_FUTURE_UNSUPPORTED",
        "Keputusan yang menghapus data hanya dapat disimpan pada atau setelah tanggal rilis agar konfirmasi tidak menimbulkan kebocoran hasil.",
        422,
      );
    }
    const { deletionConfirmation, ...announcementData } = input;
    const result = await transaction.pengumuman.upsert({ where: { calonMuridId: childId }, update: { ...announcementData, tanggalRilis, updatedById: actorId }, create: { calonMuridId: childId, ...announcementData, tanggalRilis, updatedById: actorId } });

    let effect: Awaited<ReturnType<typeof handleRejectedDecisionInTransaction>> = { type: "NONE" };
    let nextStatus: StatusKeseluruhan = released ? releasedOverallStatus(input.statusAkhir) : StatusKeseluruhan.MENUNGGU_PENGUMUMAN;
    if (released && input.statusAkhir === StatusPengumuman.TIDAK_DITERIMA) {
      effect = await handleRejectedDecisionInTransaction(transaction, childId, actorId, deletionConfirmation);
      if (effect.type === "TRANSFERRED") nextStatus = StatusKeseluruhan.DITERIMA;
      if (effect.type === "QUEUED") nextStatus = StatusKeseluruhan.MENUNGGU_KUOTA_FALLBACK;
    }
    if (effect.type === "NONE") {
      await transaction.calonMurid.update({ where: { id: childId }, data: { statusKeseluruhan: nextStatus } });
    }
    await transaction.auditLog.create({ data: { actorId, action: "UPDATE_ANNOUNCEMENT_RESULT", entity: "pengumuman", entityId: childId, detail: { before: child.pengumuman ? { statusAkhir: child.pengumuman.statusAkhir, tanggalRilis: dateOnly(child.pengumuman.tanggalRilis) } : null, after: { statusAkhir: result.statusAkhir, tanggalRilis: dateOnly(result.tanggalRilis) }, released, nextStatus, effect: effect.type } } });
    return {
      statusAkhir: effect.type === "TRANSFERRED" ? StatusPengumuman.DITERIMA : effect.type === "QUEUED" ? null : result.statusAkhir,
      tanggalRilis: result.tanggalRilis,
      released,
      nextStatus,
      effect,
      deleted: effect.type === "DELETED",
    };
  }, { maxWait: 20_000, timeout: 60_000 });
}
