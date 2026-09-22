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

  it("membatasi durasi hold antara 5 menit dan 7 hari", () => {
    expect(
      paymentModeSchema.parse({
        mode: "MIDTRANS",
        holdDurationMinutes: "1440",
      }).holdDurationMinutes,
    ).toBe(1440);
    expect(
      paymentModeSchema.safeParse({
        mode: "MIDTRANS",
        holdDurationMinutes: 4,
      }).success,
    ).toBe(false);
    expect(
      paymentModeSchema.safeParse({
        mode: "MIDTRANS",
        holdDurationMinutes: 10081,
      }).success,
    ).toBe(false);
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
