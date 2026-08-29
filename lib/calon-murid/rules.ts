import {
  KategoriTipe,
  SubKategoriAlumni,
} from "@/generated/prisma/enums";
import { CalonMuridError } from "@/lib/calon-murid/errors";

type AvailabilityInput = {
  statusAktif: boolean;
  periodeMulai: Date | null;
  periodeSelesai: Date | null;
  kuotaMaks: number | null;
  kuotaTerpakai: number;
};

export type Availability = {
  available: boolean;
  reason: "INACTIVE" | "NOT_STARTED" | "ENDED" | "FULL" | null;
};

export function jakartaDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function selectionAvailability(
  item: AvailabilityInput,
  today = jakartaDate(),
): Availability {
  if (!item.statusAktif) return { available: false, reason: "INACTIVE" };
  if (item.periodeMulai && dateOnly(item.periodeMulai) > today) {
    return { available: false, reason: "NOT_STARTED" };
  }
  if (item.periodeSelesai && dateOnly(item.periodeSelesai) < today) {
    return { available: false, reason: "ENDED" };
  }
  if (item.kuotaMaks !== null && item.kuotaTerpakai >= item.kuotaMaks) {
    return { available: false, reason: "FULL" };
  }
  return { available: true, reason: null };
}

export function assertSelectionAvailable(item: AvailabilityInput) {
  const availability = selectionAvailability(item);
  if (availability.available) return;

  if (availability.reason === "FULL") {
    throw new CalonMuridError(
      "QUOTA_FULL",
      "Kuota pilihan ini sudah penuh.",
      409,
    );
  }
  throw new CalonMuridError(
    "CLOSED",
    "Pilihan ini belum atau tidak lagi dibuka.",
    422,
  );
}

export function normalizedSubKategori(
  tipe: KategoriTipe,
  input: {
    subKategoriEnum: SubKategoriAlumni | null;
    subKategoriText: string | null;
  },
) {
  if (tipe === KategoriTipe.ALUMNI_TKFI) {
    if (!input.subKategoriEnum) {
      throw new CalonMuridError(
        "INVALID_STAGE",
        "Pilih asal TKIT Fitrah Insani.",
        422,
      );
    }
    return { subKategoriEnum: input.subKategoriEnum, subKategoriText: null };
  }

  const asalTk = input.subKategoriText?.trim();
  if (!asalTk || asalTk.length < 2) {
    throw new CalonMuridError(
      "INVALID_STAGE",
      "Nama asal TK wajib diisi minimal 2 karakter.",
      422,
    );
  }
  return { subKategoriEnum: null, subKategoriText: asalTk };
}

export function availabilityLabel(availability: Availability) {
  switch (availability.reason) {
    case "INACTIVE":
      return "Tidak aktif";
    case "NOT_STARTED":
      return "Belum dibuka";
    case "ENDED":
      return "Pendaftaran ditutup";
    case "FULL":
      return "Kuota penuh";
    default:
      return "Tersedia";
  }
}
