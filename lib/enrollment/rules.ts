import { TipeInput } from "@/generated/prisma/enums";

export type ValidatableField = {
  id: string;
  tipeInput: TipeInput;
  wajib: boolean;
  validasi: string | null;
  minAgeYears?: number | null;
  ageReferenceMonth?: number | null;
  ageReferenceYear?: number | null;
};

export const indonesianMonthNames = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
] as const;

export function ageRequirementText(field: ValidatableField) {
  if (field.minAgeYears == null || field.ageReferenceMonth == null || field.ageReferenceYear == null) return null;
  return `usia minimal ${field.minAgeYears} tahun per ${indonesianMonthNames[field.ageReferenceMonth - 1]} ${field.ageReferenceYear}`;
}

export function meetsMinimumAgeByMonth(dateOfBirth: string, minimumYears: number, referenceMonth: number, referenceYear: number) {
  if (!validIsoDate(dateOfBirth) || !Number.isInteger(minimumYears) || minimumYears < 1 ||
      !Number.isInteger(referenceMonth) || referenceMonth < 1 || referenceMonth > 12 ||
      !Number.isInteger(referenceYear)) return false;
  const birthYear = Number(dateOfBirth.slice(0, 4));
  const birthMonth = Number(dateOfBirth.slice(5, 7));
  const birthYearCutoff = referenceYear - minimumYears;
  if (birthYear < birthYearCutoff) return true;
  return birthYear === birthYearCutoff && birthMonth <= referenceMonth;
}

export function isIndonesianWhatsApp(value: string) {
  return /^(?:\+62|62|0)8[1-9][0-9]{6,10}$/.test(value);
}

export function normalizeEnrollmentValue(
  value: string,
  tipeInput: TipeInput,
) {
  return tipeInput === TipeInput.TEXTAREA ? value.trim() : value.trim();
}

function validIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function fieldValueError(
  field: ValidatableField,
  value: string,
  requireValue: boolean,
) {
  if (!value) {
    return requireValue && field.wajib ? "Field ini wajib diisi." : null;
  }
  if (field.tipeInput === TipeInput.TEXT && value.length > 1_000) {
    return "Jawaban maksimal 1.000 karakter.";
  }
  if (field.tipeInput === TipeInput.TEXTAREA && value.length > 10_000) {
    return "Jawaban maksimal 10.000 karakter.";
  }
  if (
    field.tipeInput === TipeInput.EMAIL &&
    (value.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
  ) {
    return "Masukkan alamat email yang valid.";
  }
  if (field.tipeInput === TipeInput.DATE && !validIsoDate(value)) {
    return "Masukkan tanggal yang valid.";
  }
  if (
    field.tipeInput === TipeInput.DATE &&
    field.minAgeYears != null &&
    field.ageReferenceMonth != null &&
    field.ageReferenceYear != null &&
    !meetsMinimumAgeByMonth(value, field.minAgeYears, field.ageReferenceMonth, field.ageReferenceYear)
  ) {
    return `Mohon maaf, usia calon murid belum mencapai batas minimal ${field.minAgeYears} tahun per ${indonesianMonthNames[field.ageReferenceMonth - 1]} ${field.ageReferenceYear}.`;
  }
  if (
    field.tipeInput === TipeInput.NUMBER &&
    (value.length > 100 || !/^-?\d+(?:[.,]\d+)?$/.test(value))
  ) {
    return "Masukkan angka yang valid.";
  }
  if (field.tipeInput === TipeInput.TEL && value.length > 30) {
    return "Nomor telepon terlalu panjang.";
  }
  if (
    field.validasi === "format_wa_indonesia" &&
    !isIndonesianWhatsApp(value)
  ) {
    return "Gunakan nomor Indonesia, misalnya 081234567890 atau +6281234567890.";
  }
  return null;
}

export function validateFieldValues(
  fields: ValidatableField[],
  values: Map<string, string>,
  requireValues: boolean,
) {
  const errors: Record<string, string[]> = {};
  for (const field of fields) {
    const error = fieldValueError(
      field,
      values.get(field.id) ?? "",
      requireValues,
    );
    if (error) errors[field.id] = [error];
  }
  return errors;
}
