import { describe, expect, it } from "vitest";

import { TahapKonten } from "@/generated/prisma/enums";
import { announcementInputSchema, deleteStageContentSchema, participantStageTypeParamSchema, stageContentInputSchema, stageTypeParamSchema } from "@/lib/stages/schemas";

describe("Phase 7 schemas", () => {
  it("menerima slug tahap lowercase", () => {
    expect(stageTypeParamSchema.parse("assessment")).toBe(TahapKonten.ASSESSMENT);
    expect(stageTypeParamSchema.parse("admission-fee")).toBe(TahapKonten.ADMISSION_FEE);
    expect(stageTypeParamSchema.parse("join-wa")).toBe(TahapKonten.JOIN_WA);
    expect(stageTypeParamSchema.parse("home")).toBe(TahapKonten.HOME);
    expect(participantStageTypeParamSchema.safeParse("home").success).toBe(false);
  });

  it("mensyaratkan konfirmasi eksplisit ketika menghapus konten", () => {
    const id = "10000000-0000-4000-8000-000000000001";
    expect(deleteStageContentSchema.safeParse({ id, confirmation: "HAPUS" }).success).toBe(true);
    expect(deleteStageContentSchema.safeParse({ id, confirmation: "hapus" }).success).toBe(false);
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
