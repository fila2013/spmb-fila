"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";

import { UserRole } from "@/generated/prisma/enums";
import type { AdminDeletionActionState } from "@/lib/admin-deletion/action-state";
import { AdminDeletionError } from "@/lib/admin-deletion/errors";
import {
  deleteGuardianSchema,
  deleteParticipantSchema,
} from "@/lib/admin-deletion/schemas";
import {
  deleteGuardian,
  deleteParticipant,
} from "@/lib/admin-deletion/service";
import { requireRole } from "@/lib/auth/session";

function errorState(error: unknown): AdminDeletionActionState {
  if (error instanceof ZodError) {
    return {
      status: "error",
      message: "Periksa kembali data konfirmasi.",
      fieldErrors: Object.fromEntries(
        Object.entries(error.flatten().fieldErrors).filter(
          (entry): entry is [string, string[]] => Boolean(entry[1]),
        ),
      ),
    };
  }
  if (error instanceof AdminDeletionError) {
    return { status: "error", message: error.message };
  }
  return {
    status: "error",
    message: "Penghapusan belum dapat diproses.",
  };
}

export async function deleteParticipantAction(
  _state: AdminDeletionActionState,
  formData: FormData,
): Promise<AdminDeletionActionState> {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const input = deleteParticipantSchema.parse({
      id: formData.get("id"),
      confirmation: formData.get("confirmation"),
    });
    await deleteParticipant(input, admin.userId);
  } catch (error) {
    return errorState(error);
  }
  revalidatePath("/admin/peserta");
  revalidatePath("/admin/wali-murid");
  revalidatePath("/admin/jalur");
  revalidatePath("/admin/kategori");
  redirect("/admin/peserta?deleted=1");
}

export async function deleteGuardianAction(
  _state: AdminDeletionActionState,
  formData: FormData,
): Promise<AdminDeletionActionState> {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const input = deleteGuardianSchema.parse({
      id: formData.get("id"),
      confirmation: formData.get("confirmation"),
    });
    await deleteGuardian(input, admin.userId);
  } catch (error) {
    return errorState(error);
  }
  revalidatePath("/admin/wali-murid");
  redirect("/admin/wali-murid?deleted=1");
}
