import { describe, expect, it } from "vitest";

import { PilihanJalurFinal } from "@/generated/prisma/enums";
import { finalRouteChoiceSchema } from "@/lib/final-route-choice/schemas";

describe("final route choice validation", () => {
  it("mewajibkan konfirmasi eksplisit untuk keputusan satu kali", () => {
    expect(finalRouteChoiceSchema.safeParse({
      pilihan: PilihanJalurFinal.JALUR_FALLBACK,
    }).success).toBe(false);
    expect(finalRouteChoiceSchema.safeParse({
      pilihan: PilihanJalurFinal.JALUR_FALLBACK,
      confirmation: "SETUJU",
    }).success).toBe(true);
  });
});
