import { describe, expect, it } from "vitest";

import { TahapKonten } from "@/generated/prisma/enums";
import { announcementInputSchema, stageContentInputSchema, stageTypeParamSchema } from "@/lib/stages/schemas";

describe("Phase 7 schemas", () => {
  it("menerima slug tahap lowercase", () => {
    expect(stageTypeParamSchema.parse("assessment")).toBe(TahapKonten.ASSESSMENT);
  });

  it("menormalisasi scope dan tanggal konten kosong", () => {
    const value = stageContentInputSchema.parse({ tahap: "ASSESSMENT", judul: "Jadwal", tanggal: "", isiTeks: " Info ", gambarUrl: null, urutanLayout: "0", statusAktif: true, jalurId: "", kategoriId: "" });
    expect(value).toMatchObject({ tanggal: null, isiTeks: "Info", jalurId: null, kategoriId: null, urutanLayout: 0 });
  });

  it("mensyaratkan keputusan dan tanggal rilis valid", () => {
    expect(announcementInputSchema.safeParse({ statusAkhir: "DITERIMA", tanggalRilis: "2026-09-30" }).success).toBe(true);
    expect(announcementInputSchema.safeParse({ statusAkhir: "DITERIMA", tanggalRilis: "30-09-2026" }).success).toBe(false);
  });
});
