import { describe, expect, it } from "vitest";

import {
  parsePaymentReturnState,
  paymentReturnUrl,
} from "@/lib/payment/navigation";

describe("payment return navigation", () => {
  it("builds a local dashboard return URL", () => {
    expect(
      paymentReturnUrl(
        "95dd3aba-b233-4da8-98fd-c9e837d2c924",
        "success",
      ),
    ).toBe(
      "/dashboard?payment=success&child=95dd3aba-b233-4da8-98fd-c9e837d2c924",
    );
  });

  it("only accepts known return states", () => {
    expect(parsePaymentReturnState("checking")).toBe("checking");
    expect(parsePaymentReturnState("javascript:alert(1)")).toBeNull();
    expect(parsePaymentReturnState(undefined)).toBeNull();
  });
});
