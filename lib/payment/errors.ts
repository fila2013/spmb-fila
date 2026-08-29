export type PaymentErrorCode =
  | "NOT_FOUND"
  | "INVALID_STAGE"
  | "PAYMENT_REQUIRED"
  | "FEE_NOT_CONFIGURED"
  | "AMOUNT_MISMATCH"
  | "MERCHANT_MISMATCH"
  | "INVALID_SIGNATURE"
  | "INVALID_PAYLOAD"
  | "GATEWAY_ERROR";

export class PaymentError extends Error {
  constructor(
    public readonly code: PaymentErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

export class MidtransGatewayError extends PaymentError {
  constructor(public readonly gatewayStatus: number | null = null) {
    super(
      "GATEWAY_ERROR",
      "Layanan pembayaran Sandbox belum dapat membuat transaksi. Silakan coba kembali.",
      502,
    );
    this.name = "MidtransGatewayError";
  }
}
