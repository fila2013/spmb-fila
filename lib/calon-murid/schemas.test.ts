import { describe, expect, it } from "vitest";

import { SubKategoriAlumni } from "@/generated/prisma/enums";
import {
  createCalonMuridSchema,
  selectKategoriSchema,
} from "@/lib/calon-murid/schemas";

describe("calon murid schemas", () => {
  it("merapikan nama anak dan menolak nama kosong", () => {
    expect(createCalonMuridSchema.parse({ namaAnak: "  Aisyah Fitrah  " })).toEqual({ namaAnak: "Aisyah Fitrah" });
    expect(createCalonMuridSchema.safeParse({ namaAnak: " " }).success).toBe(false);
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
