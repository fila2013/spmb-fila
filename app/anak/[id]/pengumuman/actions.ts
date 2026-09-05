"use server";

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";

import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import { CalonMuridError } from "@/lib/calon-murid/errors";
import { finalRouteChoiceSchema } from "@/lib/final-route-choice/schemas";
import { chooseFinalRoute } from "@/lib/final-route-choice/service";

export type FinalRouteChoiceActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const initialFinalRouteChoiceActionState: FinalRouteChoiceActionState = {
  status: "idle",
};

export async function chooseFinalRouteAction(
  _state: FinalRouteChoiceActionState,
  formData: FormData,
): Promise<FinalRouteChoiceActionState> {
  try {
    const wali = await requireRole(UserRole.WALI_MURID);
    const childId = z.uuid().parse(formData.get("childId"));
    const input = finalRouteChoiceSchema.parse({
      pilihan: formData.get("pilihan"),
      confirmation: formData.get("confirmation"),
    });
    const result = await chooseFinalRoute(childId, input, wali.userId);
    revalidatePath(`/anak/${childId}/pengumuman`);
    revalidatePath(`/anak/${childId}/daftar-ulang`);
    revalidatePath("/dashboard");
    return {
      status: "success",
      message: result.queued
        ? "Pilihan Reguler tersimpan. Kuota TCP sudah dilepas dan pendaftaran masuk antrean kuota Reguler."
        : "Pilihan jalur final berhasil disimpan.",
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        status: "error",
        message: "Pilih salah satu jalur final dan konfirmasi keputusan Anda.",
      };
    }
    if (error instanceof CalonMuridError) {
      return { status: "error", message: error.message };
    }
    return {
      status: "error",
      message: "Pilihan jalur belum dapat disimpan. Muat ulang dan coba kembali.",
    };
  }
}
