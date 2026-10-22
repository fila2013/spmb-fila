"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { StatusAssessment, StatusKeseluruhan, UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import { FallbackError } from "@/lib/fallback/errors";
import type { StageActionState } from "@/lib/stages/action-state";
import { StageError } from "@/lib/stages/errors";
import {
  announcementInputSchema,
  announcementTemplateSchema,
  assessmentInputSchema,
  deleteStageContentSchema,
  stageContentInputSchema,
  stageIdSchema,
  updateStageContentSchema,
} from "@/lib/stages/schemas";
import { dateOnly, stageContentSlug } from "@/lib/stages/rules";
import {
  createStageContent,
  deleteStageContent,
  updateAnnouncement,
  updateAssessment,
  updateStageContent,
  uploadStageImage,
} from "@/lib/stages/service";
import { saveAnnouncementTemplates } from "@/lib/stages/announcement-template-service";

export async function saveAnnouncementTemplatesAction(_state: StageActionState, formData: FormData): Promise<StageActionState> {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const input = announcementTemplateSchema.parse({ diterima: formData.get("diterima"), tidakDiterima: formData.get("tidakDiterima") });
    const templates = await saveAnnouncementTemplates(input, admin.userId);
    revalidatePath("/admin/konten/announcement");
    revalidatePath("/anak/[id]/pengumuman", "page");
    return { status: "success", message: "Template surat pengumuman berhasil disimpan.", templates };
  } catch (error) { return errorState(error); }
}

function revalidateContentPaths(tahap: string) {
  revalidatePath(`/admin/konten/${stageContentSlug(tahap)}`);
  if (tahap === "HOME") revalidatePath("/");
  if (tahap === "JOIN_WA") revalidatePath("/anak/[id]/join-wa", "page");
}

function errorState(error: unknown): StageActionState {
  if (error instanceof ZodError) {
    return { status: "error", message: "Periksa kembali data yang diisi.", fieldErrors: Object.fromEntries(Object.entries(error.flatten().fieldErrors).filter((entry): entry is [string, string[]] => Boolean(entry[1]))) };
  }
  if (error instanceof StageError) return { status: "error", message: error.message };
  if (error instanceof FallbackError) return { status: "error", message: error.message };
  return { status: "error", message: "Perubahan belum dapat disimpan." };
}

function contentValues(formData: FormData, gambarUrl: string | null) {
  return {
    tahap: formData.get("tahap"),
    judul: formData.get("judul"),
    tanggal: formData.get("tanggal"),
    isiTeks: formData.get("isiTeks"),
    gambarUrl,
    youtubeVideoId: formData.get("youtubeVideoId"),
    judulTutorial: formData.get("judulTutorial"),
    urutanLayout: formData.get("urutanLayout"),
    minParticipantOrder: formData.get("minParticipantOrder"),
    maxParticipantOrder: formData.get("maxParticipantOrder"),
    statusAktif: formData.get("statusAktif") === "on",
    jalurId: formData.get("jalurId"),
    kategoriId: formData.get("kategoriId"),
  };
}

function existingImageValue(formData: FormData) {
  const existing = formData.get("gambarUrl");
  return typeof existing === "string" && existing ? existing : null;
}

async function uploadedImageValue(formData: FormData) {
  const file = formData.get("gambar");
  if (file instanceof File && file.size > 0) return uploadStageImage(file);
  return null;
}

export async function createStageContentAction(_state: StageActionState, formData: FormData): Promise<StageActionState> {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const validated = stageContentInputSchema.parse(contentValues(formData, existingImageValue(formData)));
    const input = { ...validated, gambarUrl: await uploadedImageValue(formData) ?? validated.gambarUrl };
    await createStageContent(input, admin.userId);
    revalidateContentPaths(input.tahap);
    return { status: "success", message: "Konten berhasil ditambahkan." };
  } catch (error) { return errorState(error); }
}

export async function updateStageContentAction(_state: StageActionState, formData: FormData): Promise<StageActionState> {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const validated = updateStageContentSchema.parse({ id: formData.get("id"), ...contentValues(formData, existingImageValue(formData)) });
    const input = { ...validated, gambarUrl: await uploadedImageValue(formData) ?? validated.gambarUrl };
    await updateStageContent(input, admin.userId);
    revalidateContentPaths(input.tahap);
    return { status: "success", message: "Konten berhasil diperbarui." };
  } catch (error) { return errorState(error); }
}

export async function deleteStageContentAction(_state: StageActionState, formData: FormData): Promise<StageActionState> {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const input = deleteStageContentSchema.parse({
      id: formData.get("id"),
      confirmation: formData.get("confirmation"),
    });
    const deleted = await deleteStageContent(input.id, admin.userId);
    revalidateContentPaths(deleted.tahap);
    return { status: "success", message: "Konten berhasil dihapus." };
  } catch (error) { return errorState(error); }
}

export async function updateAssessmentAction(_state: StageActionState, formData: FormData): Promise<StageActionState> {
  try {
    const { id } = await saveAssessment(formData);
    revalidatePath(`/admin/peserta/${id}`);
    revalidatePath("/admin/peserta");
    return { status: "success", message: "Hasil assessment berhasil disimpan." };
  } catch (error) { return errorState(error); }
}

async function saveAssessment(formData: FormData) {
  const admin = await requireRole(UserRole.ADMIN);
  const id = stageIdSchema.parse(formData.get("id"));
  const input = assessmentInputSchema.parse({ status: formData.get("status"), catatan: formData.get("catatan") });
  await updateAssessment(id, input, admin.userId);
  return { id, input };
}

export async function quickUpdateAssessmentAction(_state: StageActionState, formData: FormData): Promise<StageActionState> {
  try {
    const { id, input } = await saveAssessment(formData);
    revalidatePath(`/admin/peserta/${id}`);
    return {
      status: "success",
      message: "Hasil assessment berhasil disimpan.",
      quickEdit: {
        nextStatus: input.status === StatusAssessment.BELUM
          ? StatusKeseluruhan.MENUNGGU_ASESMEN
          : StatusKeseluruhan.MENUNGGU_PENGUMUMAN,
        assessment: input,
      },
    };
  } catch (error) { return errorState(error); }
}

export async function updateAnnouncementAction(_state: StageActionState, formData: FormData): Promise<StageActionState> {
  let result: Awaited<ReturnType<typeof updateAnnouncement>>;
  let id: string;
  try {
    ({ id, result } = await saveAnnouncement(formData));
  } catch (error) { return errorState(error); }
  revalidatePath("/admin/peserta");
  revalidatePath(`/anak/${id}/pengumuman`);
  revalidatePath(`/admin/peserta/${id}`);
  return { status: "success", message: announcementSuccessMessage(result) };
}

async function saveAnnouncement(formData: FormData) {
  const admin = await requireRole(UserRole.ADMIN);
  const id = stageIdSchema.parse(formData.get("id"));
  const input = announcementInputSchema.parse({ statusAkhir: formData.get("statusAkhir"), tanggalRilis: formData.get("tanggalRilis") });
  const result = await updateAnnouncement(id, input, admin.userId);
  return { id, result };
}

function announcementSuccessMessage(result: Awaited<ReturnType<typeof updateAnnouncement>>) {
  return result.nextStatus === "MENUNGGU_PILIHAN_JALUR"
    ? "Pengumuman dirilis; wali perlu memilih kelas final sebelum daftar ulang."
    : result.released
        ? "Pengumuman disimpan dan sudah dirilis."
        : "Pengumuman disimpan untuk tanggal rilis tersebut.";
}

export async function quickUpdateAnnouncementAction(_state: StageActionState, formData: FormData): Promise<StageActionState> {
  try {
    const { id, result } = await saveAnnouncement(formData);
    revalidatePath(`/anak/${id}/pengumuman`);
    revalidatePath(`/admin/peserta/${id}`);
    return {
      status: "success",
      message: announcementSuccessMessage(result),
      quickEdit: {
        nextStatus: result.nextStatus,
        deleted: result.deleted,
        announcement: {
          statusAkhir: result.statusAkhir,
          tanggalRilis: dateOnly(result.tanggalRilis) ?? "",
        },
      },
    };
  } catch (error) { return errorState(error); }
}
