import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { GuardianWhatsAppQr } from "@/components/admin/guardian-whatsapp-qr";
import { createWhatsAppChatUrl } from "@/lib/enrollment/whatsapp-chat-url";

it("merender QR SVG dan tautan wa.me pada kartu nomor WA", () => {
  const url = createWhatsAppChatUrl("082280179007", "Alya");
  if (!url) throw new Error("URL WhatsApp tidak terbentuk untuk nomor valid.");

  const html = renderToStaticMarkup(
    createElement(GuardianWhatsAppQr, { url, role: "bunda" }),
  );
  expect(html).toContain("Tampilkan QR chat WhatsApp Bunda");
  expect(html).toContain("<svg");
  expect(html).toContain("<path");
  expect(html).toContain("QR chat WhatsApp Bunda");
  expect(html).toContain("https://wa.me/6282280179007?text=");
});
