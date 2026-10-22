import { describe, expect, it } from "vitest";

import { StatusPengumuman } from "@/generated/prisma/enums";
import { defaultAnnouncementTemplates, renderAnnouncementLetter } from "@/lib/stages/announcement-letter";
import { announcementTemplateSchema } from "@/lib/stages/schemas";

describe("template surat pengumuman", () => {
  it.each([StatusPengumuman.DITERIMA, StatusPengumuman.TIDAK_DITERIMA])("menggabungkan seluruh variabel untuk %s", (status) => {
    const text = renderAnnouncementLetter(defaultAnnouncementTemplates, { namaPeserta: "Randa Admiral", jalur: "Reguler", status });
    expect(text).toContain("Randa Admiral");
    expect(text).toContain("Jalur Pendaftaran: Reguler");
    expect(text).toContain(`Keputusan: ${status === StatusPengumuman.DITERIMA ? "DITERIMA" : "TIDAK DITERIMA"}`);
    expect(text).not.toMatch(/\{(nama_peserta|jalur|status_keputusan)\}/);
  });

  it("mengganti variabel berulang tanpa memproses ulang nilai pengganti", () => {
    const text = renderAnnouncementLetter({ diterima: "{nama_peserta} / {nama_peserta} / {jalur}", tidakDiterima: "Tidak diterima" }, {
      namaPeserta: "Anak $& {jalur}", jalur: "TCP", status: StatusPengumuman.DITERIMA,
    });
    expect(text).toBe("Anak $& {jalur} / Anak $& {jalur} / TCP");
  });

  it("menolak template kosong, terlalu panjang, dan variabel salah ketik", () => {
    expect(announcementTemplateSchema.safeParse(defaultAnnouncementTemplates).success).toBe(true);
    for (const diterima of [" ", "x".repeat(10001), "Yth. {nama_anak}"]) {
      expect(announcementTemplateSchema.safeParse({ ...defaultAnnouncementTemplates, diterima }).success).toBe(false);
    }
  });
});
