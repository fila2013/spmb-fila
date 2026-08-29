"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";

import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import type { CalonMuridActionState } from "@/lib/calon-murid/action-state";
import { CalonMuridError } from "@/lib/calon-murid/errors";
import {
  calonMuridIdSchema,
  createCalonMuridWithJalurSchema,
  selectKategoriSchema,
} from "@/lib/calon-murid/schemas";
import {
  createCalonMuridWithJalur,
  selectKategori,
} from "@/lib/calon-murid/service";

function actionError(error: unknown): CalonMuridActionState {
  if (error instanceof ZodError) {
    return {
      status: "error",
      message: "Periksa kembali data yang dimasukkan.",
      fieldErrors: Object.fromEntries(
        Object.entries(error.flatten().fieldErrors).filter(
          (entry): entry is [string, string[]] => Boolean(entry[1]),
        ),
      ),
    };
  }
  if (error instanceof CalonMuridError) {
    return { status: "error", message: error.message };
  }
  return {
    status: "error",
    message: "Pendaftaran belum dapat disimpan. Silakan coba kembali.",
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
      jalurId: formData.get("jalurId"),
    });
    const child = await createCalonMuridWithJalur(input, user.userId);
    childId = child.id;
    revalidatePath("/dashboard");
  } catch (error) {
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
    return actionError(error);
  }
  redirect(`/anak/${childId}/pembayaran-pendaftaran`);
}
