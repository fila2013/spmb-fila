import { z } from "zod";

export const midtransNotificationSchema = z
  .object({
    order_id: z.string().min(1).max(50),
    status_code: z.string().regex(/^\d{3}$/),
    gross_amount: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
    signature_key: z.string().regex(/^[a-fA-F0-9]{128}$/),
    transaction_status: z.string().min(1).max(40),
    fraud_status: z.string().max(30).optional(),
    payment_type: z.string().max(30).optional(),
    transaction_id: z.string().max(100).optional(),
    merchant_id: z.string().max(50).optional(),
    currency: z.string().max(10).optional(),
    status_message: z.string().max(500).optional(),
    settlement_time: z.string().max(50).optional(),
  })
  .passthrough();

export const snapTransactionResponseSchema = z.object({
  token: z.string().min(1),
  redirect_url: z.url(),
});

export type MidtransNotification = z.infer<
  typeof midtransNotificationSchema
>;
