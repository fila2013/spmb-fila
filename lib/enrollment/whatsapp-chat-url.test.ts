import { describe, expect, it } from "vitest";

import { FormType } from "@/generated/prisma/enums";
import {
  createWhatsAppChatUrl,
  guardianRoleForPhoneField,
  guardianWhatsAppUrlFromEnrollment,
  normalizeWhatsAppForUrl,
} from "@/lib/enrollment/whatsapp-chat-url";

describe("URL WhatsApp wali enrollment", () => {
  it.each([
    ["081275690392", "6281275690392"],
    ["6281275690392", "6281275690392"],
    ["+6281275690392", "6281275690392"],
    ["0812 7569-0392", "6281275690392"],
  ])("menormalkan nomor %s menjadi %s", (input, expected) => {
    expect(normalizeWhatsAppForUrl(input)).toBe(expected);
  });

  it("menolak nomor selain WA Indonesia yang valid", () => {
    expect(normalizeWhatsAppForUrl("+62123456789")).toBeNull();
    expect(normalizeWhatsAppForUrl("0812abc0392")).toBeNull();
    expect(createWhatsAppChatUrl("12345", "Alya")).toBeNull();
  });

  it("membentuk URL wa.me dengan pesan default yang aman untuk query string", () => {
    const url = createWhatsAppChatUrl("082280179007", "Alya & Bima");
    if (!url) throw new Error("URL WhatsApp tidak terbentuk untuk nomor valid.");
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://wa.me");
    expect(parsed.pathname).toBe("/6282280179007");
    expect(parsed.searchParams.get("text")).toBe(
      "Halo Bapak/Ibu Wali Murid Alya & Bima, kami dari Panitia SPMB SDIT Fitrah Insani Langkapura.",
    );
    expect(url).toContain("Alya%20%26%20Bima");
  });

  it("dapat menghilangkan pesan atau menggunakan pesan khusus", () => {
    expect(createWhatsAppChatUrl("081275690392", "Alya", null)).toBe(
      "https://wa.me/6281275690392",
    );
    expect(createWhatsAppChatUrl("081275690392", "Alya", "Halo, Ayah!"))
      .toBe("https://wa.me/6281275690392?text=Halo%2C%20Ayah!");
  });

  it("memasangkan nomor Ayah/Bunda hanya dari Data Pribadi", () => {
    const answers = [
      { field: { formType: FormType.DATA_PRIBADI, label: "No. WA Ayah" }, value: "081275690392" },
      { field: { formType: FormType.DATA_PRIBADI, label: "No. WA Bunda" }, value: "082280179007" },
    ];
    expect(guardianWhatsAppUrlFromEnrollment(answers, "ayah", "Alya"))
      .toContain("https://wa.me/6281275690392?text=");
    expect(guardianWhatsAppUrlFromEnrollment(answers, "bunda", "Alya"))
      .toContain("https://wa.me/6282280179007?text=");
    expect(
      guardianRoleForPhoneField({ formType: FormType.OBSERVASI, label: "No. WA Ayah" }),
    ).toBeNull();
    expect(guardianWhatsAppUrlFromEnrollment(answers.slice(0, 1), "bunda", "Alya"))
      .toBeNull();
  });
});
