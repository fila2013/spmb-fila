"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import type { EnrollmentActionState } from "@/lib/enrollment/action-state";
import { EnrollmentError } from "@/lib/enrollment/errors";
import {
  formFieldIdSchema,
  formFieldInputSchema,
  registrationAgeRuleSchema,
  updateFormFieldSchema,
} from "@/lib/enrollment/schemas";
import {
  createFormField,
  deleteFormField,
  updateFormField,
  updateRegistrationAgeRule,
} from "@/lib/enrollment/service";

function formValues(formData: FormData) {
  const optionalNumber = (name: string) => {
    const value = formData.get(name);
    return value === null || value === "" ? null : Number(value);
  };
  return {
    formType: formData.get("formType"),
    label: formData.get("label"),
    tipeInput: formData.get("tipeInput"),
    wajib: formData.get("wajib") === "on",
    urutan: Number(formData.get("urutan")),
    validasi: formData.get("validasi") || null,
    autoFillSource: formData.get("autoFillSource") || null,
    minAgeYears: optionalNumber("minAgeYears"),
    ageReferenceMonth: optionalNumber("ageReferenceMonth"),
    ageReferenceYear: optionalNumber("ageReferenceYear"),
  };
}

function errorState(error: unknown): EnrollmentActionState {
  if (error instanceof ZodError) {
    return {
      status: "error",
      message: "Periksa kembali konfigurasi field.",
      fieldErrors: Object.fromEntries(
        Object.entries(error.flatten().fieldErrors).filter(
          (entry): entry is [string, string[]] => Boolean(entry[1]),
        ),
      ),
    };
  }
  if (error instanceof EnrollmentError) {
    return { status: "error", message: error.message };
  }
  return { status: "error", message: "Konfigurasi field belum dapat disimpan." };
}

function refreshFormBuilder() {
  revalidatePath("/admin/form-builder");
}

export async function createFormFieldAction(
  _state: EnrollmentActionState,
  formData: FormData,
): Promise<EnrollmentActionState> {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const input = formFieldInputSchema.parse(formValues(formData));
    await createFormField(input, admin.userId);
    refreshFormBuilder();
    return { status: "success", message: "Field berhasil ditambahkan." };
  } catch (error) {
    return errorState(error);
  }
}

export async function updateFormFieldAction(
  _state: EnrollmentActionState,
  formData: FormData,
): Promise<EnrollmentActionState> {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const input = updateFormFieldSchema.parse({
      ...formValues(formData),
      id: formData.get("id"),
    });
    await updateFormField(input, admin.userId);
    refreshFormBuilder();
    return { status: "success", message: "Field berhasil diperbarui." };
  } catch (error) {
    return errorState(error);
  }
}

export async function deleteFormFieldAction(
  _state: EnrollmentActionState,
  formData: FormData,
): Promise<EnrollmentActionState> {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const id = formFieldIdSchema.parse(formData.get("id"));
    await deleteFormField(id, admin.userId);
    refreshFormBuilder();
    return { status: "success", message: "Field berhasil dihapus." };
  } catch (error) {
    return errorState(error);
  }
}

export async function updateRegistrationAgeRuleAction(
  _state: EnrollmentActionState,
  formData: FormData,
): Promise<EnrollmentActionState> {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const input = registrationAgeRuleSchema.parse({
      fieldId: formData.get("fieldId"),
      minAgeYears: Number(formData.get("minAgeYears")),
      ageReferenceMonth: Number(formData.get("ageReferenceMonth")),
      ageReferenceYear: Number(formData.get("ageReferenceYear")),
    });
    await updateRegistrationAgeRule(input, admin.userId);
    refreshFormBuilder();
    revalidatePath("/anak/tambah");
    return { status: "success", message: "Aturan usia pendaftaran berhasil diperbarui." };
  } catch (error) {
    return errorState(error);
  }
}
