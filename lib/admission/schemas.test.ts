import { describe, expect, it } from "vitest";

import { StatusPembayaran } from "@/generated/prisma/enums";
import {
  admissionVerificationSchema,
  whatsappConfirmationSchema,
  whatsappInvitationSchema,
} from "@/lib/admission/schemas";

describe("Phase 9 admission schemas", () => {
  it("mewajibkan nominal positif untuk verifikasi", () => {
    expect(admissionVerificationSchema.safeParse({ status: StatusPembayaran.VERIFIED, nominal: "", catatanAdmin: "", proofReviewed: true }).success).toBe(false);
    expect(admissionVerificationSchema.parse({ status: StatusPembayaran.VERIFIED, nominal: "2500000", catatanAdmin: "Sesuai", proofReviewed: true }).nominal).toBe(2_500_000);
  });

  it("mewajibkan admin memeriksa preview sebelum verifikasi", () => {
    expect(admissionVerificationSchema.safeParse({ status: StatusPembayaran.VERIFIED, nominal: 2_500_000, proofReviewed: false }).success).toBe(false);
  });

  it("mewajibkan alasan saat bukti ditolak", () => {
    expect(admissionVerificationSchema.safeParse({ status: StatusPembayaran.REJECTED, nominal: "", catatanAdmin: "" }).success).toBe(false);
    expect(admissionVerificationSchema.safeParse({ status: StatusPembayaran.REJECTED, nominal: "", catatanAdmin: "Bukti buram" }).success).toBe(true);
  });

  it("hanya menerima dan menormalisasi link grup WhatsApp resmi", () => {
    expect(whatsappInvitationSchema.parse({ inviteUrl: "https://chat.whatsapp.com/AbCd_123?mode=invite" }).inviteUrl).toBe("https://chat.whatsapp.com/AbCd_123");
    expect(whatsappInvitationSchema.safeParse({ inviteUrl: "https://example.com/grup" }).success).toBe(false);
    expect(whatsappInvitationSchema.safeParse({ inviteUrl: "javascript:alert(1)" }).success).toBe(false);
  });

  it("mewajibkan konfirmasi eksplisit wali", () => {
    expect(whatsappConfirmationSchema.safeParse({ confirmed: true }).success).toBe(true);
    expect(whatsappConfirmationSchema.safeParse({ confirmed: false }).success).toBe(false);
  });
});
