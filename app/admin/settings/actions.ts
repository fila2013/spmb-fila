"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import type { MasterDataActionState } from "@/lib/master-data/action-state";
import { MasterDataError } from "@/lib/master-data/errors";
import {
  bankAccountIdSchema,
  createBankAccountSchema,
  paymentModeSchema,
  updateBankAccountSchema,
} from "@/lib/payment-settings/schemas";
import {
  createBankAccount,
  deleteBankAccount,
  updateBankAccount,
  updatePaymentMode,
} from "@/lib/payment-settings/service";

function stringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

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
  return { status: "error", message: "Pengaturan pembayaran belum dapat disimpan." };
}

function refreshSettings() {
  revalidatePath("/admin/settings");
  revalidatePath("/admin/dashboard");
  revalidatePath("/dashboard");
}

export async function updatePaymentModeAction(
  _state: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const input = paymentModeSchema.parse({ mode: formData.get("mode") });
    await updatePaymentMode(input, admin.userId);
    refreshSettings();
    return { status: "success", message: "Mode pembayaran berhasil diperbarui." };
  } catch (error) {
    return errorState(error);
  }
}

export async function saveBankAccountAction(
  _state: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const values = {
      namaBank: stringValue(formData, "namaBank"),
      nomorRekening: stringValue(formData, "nomorRekening"),
      atasNama: stringValue(formData, "atasNama"),
    };
    const id = stringValue(formData, "id");
    if (id) {
      await updateBankAccount(
        updateBankAccountSchema.parse({ ...values, id }),
        admin.userId,
      );
    } else {
      await createBankAccount(createBankAccountSchema.parse(values), admin.userId);
    }
    refreshSettings();
    return { status: "success", message: "Rekening bank berhasil disimpan." };
  } catch (error) {
    return errorState(error);
  }
}

export async function deleteBankAccountAction(
  _state: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const id = bankAccountIdSchema.parse(formData.get("id"));
    await deleteBankAccount(id, admin.userId);
    refreshSettings();
    return { status: "success", message: "Rekening bank berhasil dihapus." };
  } catch (error) {
    return errorState(error);
  }
}
