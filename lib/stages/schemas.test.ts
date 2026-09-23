import { describe, expect, it } from "vitest";

import { StatusKeseluruhan, TahapKonten } from "@/generated/prisma/enums";
import { announcementInputSchema, deleteStageContentSchema, participantListFilterSchema, participantStageTypeParamSchema, stageContentInputSchema, stageTypeParamSchema } from "@/lib/stages/schemas";

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

  it("menormalisasi link YouTube menjadi video ID", () => {
    const value = stageContentInputSchema.parse({ tahap: "HOME", judul: "Profil sekolah", tanggal: "", isiTeks: "", gambarUrl: null, youtubeVideoId: "https://youtu.be/dQw4w9WgXcQ", urutanLayout: "0", statusAktif: true, jalurId: "", kategoriId: "" });
    expect(value.youtubeVideoId).toBe("dQw4w9WgXcQ");
    expect(stageContentInputSchema.safeParse({ ...value, youtubeVideoId: "https://example.com/video" }).success).toBe(false);
  });

  it("mensyaratkan keputusan dan tanggal rilis valid", () => {
    expect(announcementInputSchema.safeParse({ statusAkhir: "DITERIMA", tanggalRilis: "2026-09-30" }).success).toBe(true);
    expect(announcementInputSchema.safeParse({ statusAkhir: "DITERIMA", tanggalRilis: "30-09-2026" }).success).toBe(false);
  });

  it("menormalisasi filter daftar peserta", () => {
    const jalurId = "10000000-0000-4000-8000-000000000001";
    const kategoriId = "10000000-0000-4000-8000-000000000002";
    expect(
      participantListFilterSchema.parse({
        q: "  Aisyah  ",
        jalurId,
        kategoriId,
        statusKeseluruhan: StatusKeseluruhan.MENUNGGU_ASESMEN,
      }),
    ).toEqual({
      q: "Aisyah",
      jalurId,
      kategoriId,
      statusKeseluruhan: StatusKeseluruhan.MENUNGGU_ASESMEN,
    });
    expect(
      participantListFilterSchema.parse({
        q: "",
        jalurId: "",
        kategoriId: "",
        statusKeseluruhan: "",
      }),
    ).toEqual({});
    expect(participantListFilterSchema.safeParse({ jalurId: "bukan-uuid" }).success).toBe(false);
    expect(
      participantListFilterSchema.safeParse({ statusKeseluruhan: "TAHAP_TIDAK_ADA" })
        .success,
    ).toBe(false);
  });
});
