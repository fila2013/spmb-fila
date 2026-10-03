export function registrationAutoFillValue(
  source: string | null,
  context: { email: string; asalTk: string; namaAnak: string; tempatLahir: string; tanggalLahir: string },
) {
  if (source === "nama_anak") return context.namaAnak;
  if (source === "akun_email") return context.email;
  if (source === "kategori_asal_tk") return context.asalTk;
  if (source === "tempat_lahir") return context.tempatLahir;
  if (source === "tanggal_lahir") return context.tanggalLahir;
  return "";
}

export function initialEnrollmentValue(savedValue: string | null | undefined, fallback: string) {
  return savedValue?.trim() ? savedValue : fallback;
}

export function isUnchangedEnrollmentAnswer(savedValue: string | undefined, incoming: string) {
  return savedValue !== undefined && incoming === savedValue.trim();
}

export function isUnchangedRegistrationValue(
  incoming: string,
  registrationValue: string,
  savedValue: string | null | undefined,
) {
  return savedValue?.trim() ? incoming === savedValue.trim() : incoming === registrationValue;
}
