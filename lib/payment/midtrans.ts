import "server-only";

import { getMidtransEnvironment } from "@/lib/env/server";
import { MidtransGatewayError } from "@/lib/payment/errors";
import { midtransUrls } from "@/lib/payment/rules";
import { snapTransactionResponseSchema } from "@/lib/payment/schemas";

export type SnapTransactionInput = {
  orderId: string;
  grossAmount: number;
  childId: string;
  childName: string;
  email: string;
  routeName: string;
  categoryName: string;
  finishUrl: string;
};

export async function createMidtransSnapTransaction(
  input: SnapTransactionInput,
) {
  const environment = getMidtransEnvironment();
  const urls = midtransUrls(environment.MIDTRANS_IS_PRODUCTION);
  const authorization = Buffer.from(
    `${environment.MIDTRANS_SERVER_KEY}:`,
  ).toString("base64");

  let response: Response;
  try {
    response = await fetch(urls.snapApiUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Basic ${authorization}`,
        "content-type": "application/json",
        ...(environment.MIDTRANS_NOTIFICATION_URL
          ? {
              "x-override-notification":
                environment.MIDTRANS_NOTIFICATION_URL,
            }
          : {}),
      },
      body: JSON.stringify({
        transaction_details: {
          order_id: input.orderId,
          gross_amount: input.grossAmount,
        },
        item_details: [
          {
            id: `daftar-${input.childId.slice(0, 12)}`,
            price: input.grossAmount,
            quantity: 1,
            name: `Pendaftaran ${input.routeName} - ${input.categoryName}`.slice(
              0,
              50,
            ),
          },
        ],
        customer_details: {
          first_name: input.childName.slice(0, 255),
          email: input.email,
        },
        credit_card: { secure: true },
        callbacks: { finish: input.finishUrl },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new MidtransGatewayError();
  }

  if (!response.ok) {
    throw new MidtransGatewayError(response.status);
  }

  try {
    return snapTransactionResponseSchema.parse(await response.json());
  } catch {
    throw new MidtransGatewayError(response.status);
  }
}
