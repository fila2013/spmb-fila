"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";

import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import { FallbackError } from "@/lib/fallback/errors";
import type { StageActionState } from "@/lib/stages/action-state";
import { StageError } from "@/lib/stages/errors";
import {
  announcementInputSchema,
  assessmentInputSchema,
  deleteStageContentSchema,
  stageContentInputSchema,
  stageIdSchema,
  updateStageContentSchema,
} from "@/lib/stages/schemas";
import { stageContentSlug } from "@/lib/stages/rules";
import {
  createStageContent,
  deleteStageContent,
  updateAnnouncement,
  updateAssessment,
  updateStageContent,
  uploadStageImage,
} from "@/lib/stages/service";

function revalidateContentPaths(tahap: string) {
  revalidatePath(`/admin/konten/${stageContentSlug(tahap)}`);
  if (tahap === "HOME") revalidatePath("/");
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
    urutanLayout: formData.get("urutanLayout"),
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
    const admin = await requireRole(UserRole.ADMIN);
    const id = stageIdSchema.parse(formData.get("id"));
    const input = assessmentInputSchema.parse({ status: formData.get("status"), catatan: formData.get("catatan") });
    await updateAssessment(id, input, admin.userId);
    revalidatePath(`/admin/peserta/${id}`);
    revalidatePath("/admin/peserta");
    return { status: "success", message: "Hasil assessment berhasil disimpan." };
  } catch (error) { return errorState(error); }
}

export async function updateAnnouncementAction(_state: StageActionState, formData: FormData): Promise<StageActionState> {
  let result: Awaited<ReturnType<typeof updateAnnouncement>>;
  let id: string;
  try {
    const admin = await requireRole(UserRole.ADMIN);
    id = stageIdSchema.parse(formData.get("id"));
    const input = announcementInputSchema.parse({ statusAkhir: formData.get("statusAkhir"), tanggalRilis: formData.get("tanggalRilis"), deletionConfirmation: formData.get("deletionConfirmation") });
    result = await updateAnnouncement(id, input, admin.userId);
  } catch (error) { return errorState(error); }
  revalidatePath("/admin/peserta");
  revalidatePath(`/anak/${id}/pengumuman`);
  if (result.deleted) redirect("/admin/peserta?deleted=1");
  revalidatePath(`/admin/peserta/${id}`);
  const message = result.effect.type === "TRANSFERRED"
    ? "Peserta otomatis dipindahkan ke jalur fallback dan diterima."
    : result.effect.type === "QUEUED"
      ? "Jalur fallback penuh; peserta masuk antrian FIFO."
      : result.released
        ? "Pengumuman disimpan dan sudah dirilis."
        : "Pengumuman disimpan untuk tanggal rilis tersebut.";
  return { status: "success", message };
}
