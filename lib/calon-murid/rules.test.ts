import { describe, expect, it } from "vitest";

import {
  KategoriTipe,
  SubKategoriAlumni,
} from "@/generated/prisma/enums";
import { CalonMuridError } from "@/lib/calon-murid/errors";
import {
  normalizedSubKategori,
  selectionAvailability,
} from "@/lib/calon-murid/rules";

const base = {
  statusAktif: true,
  periodeMulai: null,
  periodeSelesai: null,
  kuotaMaks: 10,
  kuotaTerpakai: 0,
};

describe("selectionAvailability", () => {
  it("membuka pilihan aktif dalam periode dengan kuota", () => {
    expect(selectionAvailability(base, "2026-08-29")).toEqual({
      available: true,
      reason: null,
    });
  });

  it("menutup pilihan nonaktif, belum mulai, berakhir, dan penuh", () => {
    expect(selectionAvailability({ ...base, statusAktif: false }, "2026-08-29").reason).toBe("INACTIVE");
    expect(selectionAvailability({ ...base, periodeMulai: new Date("2026-08-30") }, "2026-08-29").reason).toBe("NOT_STARTED");
    expect(selectionAvailability({ ...base, periodeSelesai: new Date("2026-08-28") }, "2026-08-29").reason).toBe("ENDED");
    expect(selectionAvailability({ ...base, kuotaMaks: 1, kuotaTerpakai: 1 }, "2026-08-29").reason).toBe("FULL");
  });

  it("memperlakukan batas periode secara inklusif dan null sebagai tak terbatas", () => {
    expect(selectionAvailability({ ...base, periodeMulai: new Date("2026-08-29"), periodeSelesai: new Date("2026-08-29") }, "2026-08-29").available).toBe(true);
    expect(selectionAvailability({ ...base, kuotaMaks: null, kuotaTerpakai: 999 }, "2026-08-29").available).toBe(true);
  });
});

describe("normalizedSubKategori", () => {
  it("hanya menyimpan enum untuk alumni", () => {
    expect(normalizedSubKategori(KategoriTipe.ALUMNI_TKFI, {
      subKategoriEnum: SubKategoriAlumni.TKIT_FI_1,
      subKategoriText: "diabaikan",
    })).toEqual({ subKategoriEnum: SubKategoriAlumni.TKIT_FI_1, subKategoriText: null });
  });

  it("hanya menyimpan teks yang dirapikan untuk eksternal", () => {
    expect(normalizedSubKategori(KategoriTipe.EKSTERNAL, {
      subKategoriEnum: SubKategoriAlumni.TKIT_FI_2,
      subKategoriText: "  TK Harapan  ",
    })).toEqual({ subKategoriEnum: null, subKategoriText: "TK Harapan" });
  });

  it("menolak detail subkategori yang tidak sesuai tipe", () => {
    expect(() => normalizedSubKategori(KategoriTipe.ALUMNI_TKFI, {
      subKategoriEnum: null,
      subKategoriText: "TK lain",
    })).toThrow(CalonMuridError);
    expect(() => normalizedSubKategori(KategoriTipe.EKSTERNAL, {
      subKategoriEnum: null,
      subKategoriText: " ",
    })).toThrow(CalonMuridError);
  });
});
