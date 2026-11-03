import { describe, expect, it } from "vitest";

import { buildWhatsappDraft } from "@/lib/whatsapp/message";

const values = {
  nama_peserta: "Alya & Bima",
  nama_wali: "Ibu Nur",
  jalur: "Reguler",
  kategori: "Alumni",
  status: "Menunggu Asesmen",
};

describe("draf pesan WhatsApp peserta", () => {
  it("mengisi semua variabel dan mengodekan pesan tanpa mengubah nomor tujuan", () => {
    const draft = buildWhatsappDraft("Halo {nama_wali},\n{nama_peserta} — {jalur}/{kategori}: {status} 📚", "0812-0000-0012", values);
    const url = new URL(draft.url ?? "");
    expect(url.origin + url.pathname).toBe("https://wa.me/6281200000012");
    expect(url.searchParams.get("text")).toBe("Halo Ibu Nur,\nAlya & Bima — Reguler/Alumni: Menunggu Asesmen 📚");
    expect(url.searchParams.get("text")).toBe(draft.text);
  });

  it("tidak mengartikan nama sebagai token kedua atau sintaks penggantian", () => {
    const draft = buildWhatsappDraft("{nama_peserta} {status} {nama_peserta}", "+6281200000012", { ...values, nama_peserta: "$& {status}" });
    expect(draft.text).toBe("$& {status} Menunggu Asesmen $& {status}");
  });

  it("tidak menghasilkan tautan jika nomor atau isi pesan tidak valid", () => {
    expect(buildWhatsappDraft("Hai", "javascript:alert(1)", values).url).toBeNull();
    expect(buildWhatsappDraft(" ", "081200000012", values).url).toBeNull();
  });
});
