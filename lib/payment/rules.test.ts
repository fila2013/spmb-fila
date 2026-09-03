import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { StatusPembayaran } from "@/generated/prisma/enums";
import { PaymentError } from "@/lib/payment/errors";
import {
  assertRegistrationProofSize,
  grossAmountToInteger,
  mapMidtransStatus,
  midtransUrls,
  resolvePaymentTransition,
  sanitizedNotification,
  verifyMidtransSignature,
  validateRegistrationProof,
} from "@/lib/payment/rules";

describe("Bukti transfer pendaftaran", () => {
  it("menerima JPG, PNG, dan PDF berdasarkan MIME serta signature", () => {
    expect(
      validateRegistrationProof(
        { size: 3, type: "image/jpeg" },
        new Uint8Array([0xff, 0xd8, 0xff]),
      ),
    ).toBe("jpg");
    expect(
      validateRegistrationProof(
        { size: 8, type: "image/png" },
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe("png");
    expect(
      validateRegistrationProof(
        { size: 5, type: "application/pdf" },
        new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
      ),
    ).toBe("pdf");
  });

  it("menolak file kosong, lebih dari 500 KB, dan signature palsu", () => {
    expect(() => assertRegistrationProofSize({ size: 0 })).toThrow(PaymentError);
    expect(() =>
      assertRegistrationProofSize({ size: 500 * 1024 + 1 }),
    ).toThrow("maksimal 500 KB");
    expect(() =>
      validateRegistrationProof(
        { size: 4, type: "image/png" },
        new Uint8Array([1, 2, 3, 4]),
      ),
    ).toThrow("JPG, PNG, atau PDF");
  });
});

describe("Midtrans environment URLs", () => {
  it("menggunakan seluruh endpoint Sandbox ketika production false", () => {
    expect(midtransUrls(false)).toEqual({
      environment: "sandbox",
      snapApiUrl: "https://app.sandbox.midtrans.com/snap/v1/transactions",
      snapScriptUrl: "https://app.sandbox.midtrans.com/snap/snap.js",
      coreApiUrl: "https://api.sandbox.midtrans.com",
    });
  });

  it("memisahkan endpoint Production", () => {
    expect(midtransUrls(true).snapApiUrl).toBe(
      "https://app.midtrans.com/snap/v1/transactions",
    );
  });
});

describe("Midtrans webhook rules", () => {
  const base = {
    order_id: "SPMB-test",
    status_code: "200",
    gross_amount: "500000.00",
    signature_key: "",
    transaction_status: "settlement",
  };

  it("memverifikasi SHA-512 sesuai urutan field Midtrans", () => {
    const serverKey = "server-test";
    const signature = createHash("sha512")
      .update("SPMB-test200500000.00server-test")
      .digest("hex");
    expect(
      verifyMidtransSignature(
        { ...base, signature_key: signature },
        serverKey,
      ),
    ).toBe(true);
    expect(
      verifyMidtransSignature(
        { ...base, signature_key: "0".repeat(128) },
        serverKey,
      ),
    ).toBe(false);
  });

  it("memetakan status sukses hanya saat status code dan fraud aman", () => {
    expect(mapMidtransStatus({ ...base, fraud_status: "accept" })).toBe(
      StatusPembayaran.VERIFIED,
    );
    expect(mapMidtransStatus({ ...base, fraud_status: "deny" })).toBe(
      StatusPembayaran.REJECTED,
    );
    expect(mapMidtransStatus({ ...base, status_code: "201" })).toBe(
      StatusPembayaran.PENDING,
    );
  });

  it.each(["deny", "cancel", "expire", "failure"])(
    "memetakan %s sebagai rejected",
    (transactionStatus) => {
      expect(
        mapMidtransStatus({
          ...base,
          transaction_status: transactionStatus,
        }),
      ).toBe(StatusPembayaran.REJECTED);
    },
  );

  it("mencegah webhook pending terlambat menurunkan verified", () => {
    expect(
      resolvePaymentTransition(
        StatusPembayaran.VERIFIED,
        StatusPembayaran.PENDING,
      ),
    ).toBe(StatusPembayaran.VERIFIED);
  });

  it("mengizinkan reversal verified menjadi rejected", () => {
    expect(
      resolvePaymentTransition(
        StatusPembayaran.VERIFIED,
        StatusPembayaran.REJECTED,
      ),
    ).toBe(StatusPembayaran.REJECTED);
  });

  it("menolak pecahan atau nominal tidak aman", () => {
    expect(grossAmountToInteger("500000.00")).toBe(500_000);
    expect(() => grossAmountToInteger("500000.50")).toThrow(PaymentError);
  });

  it("tidak menyimpan signature dan detail instrumen pembayaran", () => {
    const sanitized = sanitizedNotification({
      ...base,
      signature_key: "0".repeat(128),
      va_numbers: [{ va_number: "secret", bank: "bca" }],
    });
    expect(sanitized).not.toHaveProperty("signature_key");
    expect(sanitized).not.toHaveProperty("va_numbers");
  });
});
