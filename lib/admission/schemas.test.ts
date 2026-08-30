import { describe, expect, it } from "vitest";

import { StatusPembayaran, StatusUndanganWa } from "@/generated/prisma/enums";
import {
  admissionVerificationSchema,
  whatsappInvitationSchema,
} from "@/lib/admission/schemas";

describe("Phase 9 admission schemas", () => {
  it("mewajibkan nominal positif untuk verifikasi", () => {
    expect(admissionVerificationSchema.safeParse({ status: StatusPembayaran.VERIFIED, nominal: "", catatanAdmin: "" }).success).toBe(false);
    expect(admissionVerificationSchema.parse({ status: StatusPembayaran.VERIFIED, nominal: "2500000", catatanAdmin: "Sesuai" }).nominal).toBe(2_500_000);
  });

  it("mewajibkan alasan saat bukti ditolak", () => {
    expect(admissionVerificationSchema.safeParse({ status: StatusPembayaran.REJECTED, nominal: "", catatanAdmin: "" }).success).toBe(false);
    expect(admissionVerificationSchema.safeParse({ status: StatusPembayaran.REJECTED, nominal: "", catatanAdmin: "Bukti buram" }).success).toBe(true);
  });

  it("membatasi status undangan manual", () => {
    expect(whatsappInvitationSchema.parse({ status: StatusUndanganWa.SUDAH_DIUNDANG }).status).toBe(StatusUndanganWa.SUDAH_DIUNDANG);
    expect(whatsappInvitationSchema.safeParse({ status: "TERKIRIM_OTOMATIS" }).success).toBe(false);
  });
});
