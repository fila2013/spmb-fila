function stringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function nullableNumber(formData: FormData, key: string) {
  const value = stringValue(formData, key).trim();
  return value === "" ? null : Number(value);
}

export function jalurFormValues(formData: FormData) {
  return {
    nama: stringValue(formData, "nama"),
    statusAktif: formData.get("statusAktif") === "on",
    periodeMulai: stringValue(formData, "periodeMulai"),
    periodeSelesai: stringValue(formData, "periodeSelesai"),
    kuotaMaks: nullableNumber(formData, "kuotaMaks"),
    fallbackJalurId: stringValue(formData, "fallbackJalurId"),
    hapusDataJikaGagal: formData.get("hapusDataJikaGagal") === "on",
  };
}

export function kategoriFormValues(formData: FormData) {
  return {
    nama: stringValue(formData, "nama"),
    tipe: stringValue(formData, "tipe"),
    statusAktif: formData.get("statusAktif") === "on",
    periodeMulai: stringValue(formData, "periodeMulai"),
    periodeSelesai: stringValue(formData, "periodeSelesai"),
    kuotaMaks: nullableNumber(formData, "kuotaMaks"),
  };
}

export function biayaFormValues(formData: FormData) {
  return {
    id: stringValue(formData, "id"),
    jalurId: stringValue(formData, "jalurId"),
    kategoriId: stringValue(formData, "kategoriId"),
    nominal: Number(stringValue(formData, "nominal")),
    statusAktif: formData.get("statusAktif") === "on",
  };
}

