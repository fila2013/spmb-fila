import { describe, expect, it } from "vitest";

import { ModePembayaranPendaftaran } from "@/generated/prisma/enums";
import {
  createBankAccountSchema,
  paymentModeSchema,
} from "@/lib/payment-settings/schemas";

describe("payment settings schemas", () => {
  it("membatasi mode pembayaran yang didukung", () => {
    expect(paymentModeSchema.parse({ mode: "MANUAL" }).mode).toBe(
      ModePembayaranPendaftaran.MANUAL,
    );
    expect(paymentModeSchema.safeParse({ mode: "CASH" }).success).toBe(false);
  });

  it("menormalisasi nomor rekening dan menolak karakter lain", () => {
    expect(createBankAccountSchema.parse({
      namaBank: "BSI",
      nomorRekening: "1234-5678-90",
      atasNama: "SDIT Fitrah Insani",
    }).nomorRekening).toBe("1234567890");
    expect(createBankAccountSchema.safeParse({
      namaBank: "BSI",
      nomorRekening: "rekening-utama",
      atasNama: "SDIT Fitrah Insani",
    }).success).toBe(false);
  });
});
