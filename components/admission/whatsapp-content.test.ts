import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StageContentBlocks } from "@/components/stages/stage-content";

const content = [{
  id: "join-1", judul: "Informasi grup", tanggal: null,
  isiTeks: "Selamat datang! Buka https://chat.whatsapp.com/Grup_123?mode=invite. <script>alert(1)</script>",
  gambarUrl: "https://example.test/grup.webp", youtubeVideoId: null, urutanLayout: 0,
}];

describe("tampilan link WhatsApp dari blok CMS", () => {
  it("menampilkan teks, gambar, hyperlink resmi dan CTA baru dengan aman", () => {
    const html = renderToStaticMarkup(createElement(StageContentBlocks, { content, whatsappMode: true }));
    expect(html).toContain("Selamat datang!");
    expect(html).toContain('src="https://example.test/grup.webp"');
    expect(html.match(/href="https:\/\/chat.whatsapp.com\/Grup_123"/g)).toHaveLength(2);
    expect(html.match(/target="_blank" rel="noopener noreferrer"/g)).toHaveLength(2);
    expect(html).toContain("text-blue-600 underline hover:text-blue-800");
    expect(html).toContain("Gabung Grup WhatsApp");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("tanpa URL resmi hanya menampilkan isi informasi, bukan link berbahaya", () => {
    const html = renderToStaticMarkup(createElement(StageContentBlocks, { content: [{ ...content[0], isiTeks: "https://chat.whatsapp.com.evil.test/Grup javascript:alert(1)" }], whatsappMode: true }));
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("Gabung Grup WhatsApp");
    expect(html).toContain("https://chat.whatsapp.com.evil.test/Grup");
  });
});
