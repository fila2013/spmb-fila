import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { StatusPembayaran } from "@/generated/prisma/enums";
import { PaymentError } from "@/lib/payment/errors";
import {
  grossAmountToInteger,
  mapMidtransStatus,
  midtransUrls,
  resolvePaymentTransition,
  sanitizedNotification,
  verifyMidtransSignature,
} from "@/lib/payment/rules";

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
