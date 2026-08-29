import { createHash, timingSafeEqual } from "node:crypto";

import { StatusPembayaran } from "@/generated/prisma/enums";
import { PaymentError } from "@/lib/payment/errors";
import type { MidtransNotification } from "@/lib/payment/schemas";

export function midtransUrls(isProduction: boolean) {
  return isProduction
    ? {
        environment: "production" as const,
        snapApiUrl: "https://app.midtrans.com/snap/v1/transactions",
        snapScriptUrl: "https://app.midtrans.com/snap/snap.js",
        coreApiUrl: "https://api.midtrans.com",
      }
    : {
        environment: "sandbox" as const,
        snapApiUrl:
          "https://app.sandbox.midtrans.com/snap/v1/transactions",
        snapScriptUrl: "https://app.sandbox.midtrans.com/snap/snap.js",
        coreApiUrl: "https://api.sandbox.midtrans.com",
      };
}

export function grossAmountToInteger(value: string) {
  const [whole, decimal = ""] = value.split(".");
  if (decimal && Number(decimal) !== 0) {
    throw new PaymentError(
      "AMOUNT_MISMATCH",
      "Nominal notifikasi pembayaran tidak valid.",
      422,
    );
  }
  const amount = Number(whole);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new PaymentError(
      "AMOUNT_MISMATCH",
      "Nominal notifikasi pembayaran tidak valid.",
      422,
    );
  }
  return amount;
}

export function verifyMidtransSignature(
  notification: Pick<
    MidtransNotification,
    "order_id" | "status_code" | "gross_amount" | "signature_key"
  >,
  serverKey: string,
) {
  const expected = createHash("sha512")
    .update(
      `${notification.order_id}${notification.status_code}${notification.gross_amount}${serverKey}`,
    )
    .digest();
  const received = Buffer.from(notification.signature_key, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function mapMidtransStatus(notification: {
  transaction_status: string;
  status_code: string;
  fraud_status?: string;
}) {
  const transactionStatus = notification.transaction_status.toLowerCase();
  const fraudStatus = notification.fraud_status?.toLowerCase();

  if (fraudStatus === "deny") return StatusPembayaran.REJECTED;
  if (["capture", "settlement"].includes(transactionStatus)) {
    return notification.status_code === "200" &&
      (!fraudStatus || fraudStatus === "accept")
      ? StatusPembayaran.VERIFIED
      : StatusPembayaran.PENDING;
  }
  if (["deny", "cancel", "expire", "failure"].includes(transactionStatus)) {
    return StatusPembayaran.REJECTED;
  }
  if (["pending", "authorize"].includes(transactionStatus)) {
    return StatusPembayaran.PENDING;
  }
  return null;
}

export function resolvePaymentTransition(
  current: StatusPembayaran,
  incoming: StatusPembayaran | null,
) {
  if (!incoming) return current;
  if (current === StatusPembayaran.REJECTED) return current;
  if (
    current === StatusPembayaran.VERIFIED &&
    incoming === StatusPembayaran.PENDING
  ) {
    return current;
  }
  return incoming;
}

export function sanitizedNotification(notification: MidtransNotification) {
  return {
    order_id: notification.order_id,
    status_code: notification.status_code,
    gross_amount: notification.gross_amount,
    transaction_status: notification.transaction_status,
    fraud_status: notification.fraud_status ?? null,
    payment_type: notification.payment_type ?? null,
    transaction_id: notification.transaction_id ?? null,
    merchant_id: notification.merchant_id ?? null,
    currency: notification.currency ?? null,
    status_message: notification.status_message ?? null,
    settlement_time: notification.settlement_time ?? null,
  };
}
