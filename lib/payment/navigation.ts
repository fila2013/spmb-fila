export const paymentReturnStates = [
  "success",
  "checking",
  "verified",
  "rejected",
] as const;

export type PaymentReturnState = (typeof paymentReturnStates)[number];

export function paymentReturnUrl(
  childId: string,
  state: PaymentReturnState,
) {
  const query = new URLSearchParams({ payment: state, child: childId });
  return `/dashboard?${query.toString()}`;
}

export function parsePaymentReturnState(value: string | undefined) {
  return paymentReturnStates.find((state) => state === value) ?? null;
}
