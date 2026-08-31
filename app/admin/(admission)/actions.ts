"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { AdmissionError } from "@/lib/admission/errors";
import {
  admissionIdSchema,
  admissionVerificationSchema,
  whatsappInvitationSchema,
} from "@/lib/admission/schemas";
import {
  setWhatsappInvitationLink,
  verifyAdmissionPayment,
} from "@/lib/admission/service";
import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import type { StageActionState } from "@/lib/stages/action-state";

function errorState(error: unknown): StageActionState {
  if (error instanceof ZodError) {
    return {
      status: "error",
      message: "Periksa kembali data yang diisi.",
      fieldErrors: Object.fromEntries(
        Object.entries(error.flatten().fieldErrors).filter(
          (entry): entry is [string, string[]] => Boolean(entry[1]),
        ),
      ),
    };
  }
  if (error instanceof AdmissionError) return { status: "error", message: error.message };
  return { status: "error", message: "Perubahan daftar ulang belum dapat disimpan." };
}

export async function verifyAdmissionPaymentAction(
  _state: StageActionState,
  formData: FormData,
): Promise<StageActionState> {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const paymentId = admissionIdSchema.parse(formData.get("paymentId"));
    const childId = admissionIdSchema.parse(formData.get("childId"));
    const input = admissionVerificationSchema.parse({
      status: formData.get("status"),
      nominal: formData.get("nominal"),
      catatanAdmin: formData.get("catatanAdmin"),
      proofReviewed: formData.get("proofReviewed"),
    });
    const result = await verifyAdmissionPayment(paymentId, input, admin.userId);
    revalidatePath(`/admin/peserta/${childId}`);
    revalidatePath("/admin/peserta");
    revalidatePath(`/anak/${childId}/daftar-ulang`);
    revalidatePath(`/anak/${childId}/join-wa`);
    return {
      status: "success",
      message: result.payment.status === "VERIFIED"
        ? "Pembayaran DU terverifikasi; peserta masuk tahap Join WhatsApp."
        : "Bukti DU ditolak dan wali dapat mengunggah ulang.",
    };
  } catch (error) {
    return errorState(error);
  }
}

export async function updateWhatsappInvitationAction(
  _state: StageActionState,
  formData: FormData,
): Promise<StageActionState> {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const childId = admissionIdSchema.parse(formData.get("childId"));
    const input = whatsappInvitationSchema.parse({ inviteUrl: formData.get("inviteUrl") });
    await setWhatsappInvitationLink(childId, input, admin.userId);
    revalidatePath(`/admin/peserta/${childId}`);
    revalidatePath("/admin/peserta");
    revalidatePath(`/anak/${childId}/join-wa`);
    return {
      status: "success",
      message: "Link grup WhatsApp tersimpan. Wali sekarang dapat membuka link dan mengonfirmasi sudah bergabung.",
    };
  } catch (error) {
    return errorState(error);
  }
}
