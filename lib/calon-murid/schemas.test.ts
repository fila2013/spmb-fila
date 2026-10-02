import { describe, expect, it } from "vitest";

import { SubKategoriAlumni } from "@/generated/prisma/enums";
import {
  createCalonMuridSchema,
  selectKategoriSchema,
} from "@/lib/calon-murid/schemas";

describe("calon murid schemas", () => {
  it("merapikan nama anak dan menolak nama kosong", () => {
    const input = { namaAnak: "  Aisyah Fitrah  ", tempatLahir: "  Bandar Lampung ", tanggalLahir: "2021-06-21" };
    expect(createCalonMuridSchema.parse(input)).toEqual({ namaAnak: "Aisyah Fitrah", tempatLahir: "Bandar Lampung", tanggalLahir: "2021-06-21" });
    expect(createCalonMuridSchema.safeParse({ ...input, namaAnak: " " }).success).toBe(false);
    expect(createCalonMuridSchema.safeParse({ ...input, tanggalLahir: "2021-02-30" }).success).toBe(false);
    expect(createCalonMuridSchema.safeParse({ namaAnak: "Aisyah" }).success).toBe(false);
  });

  it("tidak menerima nominal dari payload kategori", () => {
    const parsed = selectKategoriSchema.parse({
      kategoriId: "d312793d-fac5-4c13-8e1d-e75052479c1f",
      subKategoriEnum: SubKategoriAlumni.TKIT_FI_1,
      nominal: 1,
    });
    expect(parsed).not.toHaveProperty("nominal");
  });
});
