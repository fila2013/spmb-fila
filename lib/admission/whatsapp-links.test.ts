import { describe, expect, it } from "vitest";
import { normalizeWhatsappInviteUrl, whatsappTextParts, whatsappUrlsFromContent } from "@/lib/admission/whatsapp-links";

describe("link WhatsApp dari teks konten", () => {
  it("mengekstrak URL resmi di tengah paragraf, menjaga tanda baca dan isi lain", () => {
    const text = "Selamat datang!\nGrup: (https://chat.whatsapp.com/Reguler_123?mode=invite).\nTerima kasih.";
    const parts = whatsappTextParts(text);
    expect(parts.filter((part) => part.url)).toEqual([{ text: "https://chat.whatsapp.com/Reguler_123?mode=invite", url: "https://chat.whatsapp.com/Reguler_123" }]);
    expect(parts.map((part) => part.text).join("")).toBe(text);
  });

  it("menolak domain palsu, protokol tidak aman, kredensial dan path tambahan", () => {
    for (const url of ["javascript:alert(1)", "http://chat.whatsapp.com/Code", "https://chat.whatsapp.com.evil.test/Code", "https://user@chat.whatsapp.com/Code", "https://chat.whatsapp.com:8443/Code", "https://chat.whatsapp.com/Code/more", `https://chat.whatsapp.com/${"a".repeat(2048)}`]) {
      expect(normalizeWhatsappInviteUrl(url)).toBeNull();
      expect(whatsappUrlsFromContent([{ isiTeks: `Informasi ${url}` }])).toEqual([]);
    }
  });

  it("mendukung beberapa blok/link dan menghapus duplikasi URL", () => {
    expect(whatsappUrlsFromContent([
      { isiTeks: "https://chat.whatsapp.com/GrupA\nhttps://chat.whatsapp.com/GrupB" },
      { isiTeks: "https://chat.whatsapp.com/GrupA?mode=invite" },
      { isiTeks: null },
    ])).toEqual(["https://chat.whatsapp.com/GrupA", "https://chat.whatsapp.com/GrupB"]);
  });
});
