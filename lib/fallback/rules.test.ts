import { describe, expect, it } from "vitest";

import { FallbackError } from "@/lib/fallback/errors";
import {
  assertDeletionConfirmed,
  deletionConfirmation,
  hasQuotaCapacity,
  isQuotaCapacityIncreased,
} from "@/lib/fallback/rules";

describe("Phase 8 fallback rules", () => {
  it("mendeteksi kapasitas terbatas dan tanpa batas", () => {
    expect(hasQuotaCapacity({ kuotaMaks: 2, kuotaTerpakai: 1 })).toBe(true);
    expect(hasQuotaCapacity({ kuotaMaks: 2, kuotaTerpakai: 2 })).toBe(false);
    expect(hasQuotaCapacity({ kuotaMaks: null, kuotaTerpakai: 100 })).toBe(true);
  });

  it("mendeteksi penambahan kapasitas", () => {
    expect(isQuotaCapacityIncreased(2, 3)).toBe(true);
    expect(isQuotaCapacityIncreased(2, null)).toBe(true);
    expect(isQuotaCapacityIncreased(3, 3)).toBe(false);
    expect(isQuotaCapacityIncreased(null, 10)).toBe(false);
  });

  it("memerlukan frasa penghapusan yang persis", () => {
    expect(deletionConfirmation("Alya")).toBe("HAPUS Alya");
    expect(() => assertDeletionConfirmed("Alya", "HAPUS Alya")).not.toThrow();
    expect(() => assertDeletionConfirmed("Alya", "hapus Alya")).toThrowError(FallbackError);
  });
});
