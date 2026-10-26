"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";

import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import type { CalonMuridActionState } from "@/lib/calon-murid/action-state";
import { CalonMuridError } from "@/lib/calon-murid/errors";
import { PaymentError } from "@/lib/payment/errors";
import { AuthorizationError } from "@/lib/auth/errors";
import { registrationErrorDetails, registrationErrorMessage } from "@/lib/diagnostics/registration-errors";
import {
  calonMuridIdSchema,
  birthDetailsSchema,
  createCalonMuridWithJalurSchema,
  selectKategoriSchema,
} from "@/lib/calon-murid/schemas";
import {
  createCalonMuridWithJalur,
  selectKategori,
  updateBirthDetails,
} from "@/lib/calon-murid/service";

function actionError(error: unknown): CalonMuridActionState {
  if (error instanceof ZodError) {
    return {
      status: "error",
      message: registrationErrorMessage(error, "Periksa kembali data yang dimasukkan."),
      fieldErrors: Object.fromEntries(
        Object.entries(error.flatten().fieldErrors).filter(
          (entry): entry is [string, string[]] => Boolean(entry[1]),
        ),
      ),
    };
  }
  if (error instanceof CalonMuridError || error instanceof PaymentError || error instanceof AuthorizationError) {
    return { status: "error", message: error.message };
  }
  return {
    status: "error",
    message: registrationErrorMessage(error, "Pendaftaran belum dapat disimpan. Silakan coba kembali. Jika tetap gagal, hubungi panitia."),
  };
}

export async function createChildWithRouteAction(
  _state: CalonMuridActionState,
  formData: FormData,
): Promise<CalonMuridActionState> {
  let childId: string;
  try {
    const user = await requireRole(UserRole.WALI_MURID);
    const input = createCalonMuridWithJalurSchema.parse({
      namaAnak: formData.get("namaAnak"),
      tempatLahir: formData.get("tempatLahir"),
      tanggalLahir: formData.get("tanggalLahir"),
      jalurId: formData.get("jalurId"),
    });
    const child = await createCalonMuridWithJalur(input, user.userId);
    childId = child.id;
    revalidatePath("/dashboard");
  } catch (error) {
    console.error("DEBUG createChildWithRouteAction ERROR:", registrationErrorDetails(error));
    return actionError(error);
  }
  redirect(`/anak/${childId}/kategori`);
}

export async function selectCategoryAction(
  _state: CalonMuridActionState,
  formData: FormData,
): Promise<CalonMuridActionState> {
  let childId: string;
  try {
    const user = await requireRole(UserRole.WALI_MURID);
    childId = calonMuridIdSchema.parse(formData.get("calonMuridId"));
    const input = selectKategoriSchema.parse({
      kategoriId: formData.get("kategoriId"),
      subKategoriEnum: formData.get("subKategoriEnum") || null,
      subKategoriText: formData.get("subKategoriText") || null,
    });
    await selectKategori(childId, input, user.userId);
    revalidatePath("/dashboard");
    revalidatePath(`/anak/${childId}/kategori`);
  } catch (error) {
    console.error("DEBUG selectCategoryAction ERROR:", registrationErrorDetails(error));
    return actionError(error);
  }
  redirect(`/anak/${childId}/pembayaran-pendaftaran`);
}

export async function updateBirthDetailsAction(
  _state: CalonMuridActionState,
  formData: FormData,
): Promise<CalonMuridActionState> {
  let childId: string;
  try {
    const user = await requireRole(UserRole.WALI_MURID);
    childId = calonMuridIdSchema.parse(formData.get("calonMuridId"));
    const input = birthDetailsSchema.parse({
      tempatLahir: formData.get("tempatLahir"),
      tanggalLahir: formData.get("tanggalLahir"),
    });
    await updateBirthDetails(childId, input, user.userId);
    revalidatePath(`/anak/${childId}/kategori`);
  } catch (error) {
    console.error("DEBUG updateBirthDetailsAction ERROR:", registrationErrorDetails(error));
    return actionError(error);
  }
  redirect(`/anak/${childId}/kategori`);
}
