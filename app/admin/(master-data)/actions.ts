"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import type { MasterDataActionState } from "@/lib/master-data/action-state";
import { MasterDataError } from "@/lib/master-data/errors";
import {
  biayaFormValues,
  jalurFormValues,
  kategoriFormValues,
} from "@/lib/master-data/form-values";
import {
  createBiayaSchema,
  createJalurSchema,
  createKategoriSchema,
  updateBiayaSchema,
  updateJalurSchema,
  updateKategoriSchema,
} from "@/lib/master-data/schemas";
import {
  createBiaya,
  createJalur,
  createKategori,
  updateBiaya,
  updateJalur,
  updateKategori,
} from "@/lib/master-data/service";

function errorState(error: unknown): MasterDataActionState {
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
  if (error instanceof MasterDataError) {
    return { status: "error", message: error.message };
  }
  return { status: "error", message: "Perubahan belum dapat disimpan." };
}

function refreshMasterData(path: string) {
  revalidatePath(path);
  revalidatePath("/admin/dashboard");
}

export async function createJalurAction(
  _state: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const input = createJalurSchema.parse(jalurFormValues(formData));
    await createJalur(input, admin.userId);
    refreshMasterData("/admin/jalur");
    return { status: "success", message: "Jalur berhasil ditambahkan." };
  } catch (error) {
    return errorState(error);
  }
}

export async function updateJalurAction(
  _state: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const input = updateJalurSchema.parse({
      ...jalurFormValues(formData),
      id: formData.get("id"),
    });
    await updateJalur(input, admin.userId);
    refreshMasterData("/admin/jalur");
    return { status: "success", message: "Jalur berhasil diperbarui." };
  } catch (error) {
    return errorState(error);
  }
}

export async function createKategoriAction(
  _state: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const input = createKategoriSchema.parse(kategoriFormValues(formData));
    await createKategori(input, admin.userId);
    refreshMasterData("/admin/kategori");
    return { status: "success", message: "Kategori berhasil ditambahkan." };
  } catch (error) {
    return errorState(error);
  }
}

export async function updateKategoriAction(
  _state: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const input = updateKategoriSchema.parse({
      ...kategoriFormValues(formData),
      id: formData.get("id"),
    });
    await updateKategori(input, admin.userId);
    refreshMasterData("/admin/kategori");
    return { status: "success", message: "Kategori berhasil diperbarui." };
  } catch (error) {
    return errorState(error);
  }
}

export async function saveBiayaAction(
  _state: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const values = biayaFormValues(formData);
    if (values.id) {
      const input = updateBiayaSchema.parse(values);
      await updateBiaya(input, admin.userId);
    } else {
      const input = createBiayaSchema.parse(values);
      await createBiaya(input, admin.userId);
    }
    refreshMasterData("/admin/biaya-pendaftaran");
    return { status: "success", message: "Biaya berhasil disimpan." };
  } catch (error) {
    return errorState(error);
  }
}

