import { describe, expect, it } from "vitest";

import { MasterDataError } from "@/lib/master-data/errors";
import {
  assertFallbackIsNotSelf,
  assertQuotaCanBeSet,
} from "@/lib/master-data/rules";

describe("master data business rules", () => {
  it("mengizinkan kuota sama dengan pemakaian", () => {
    expect(() => assertQuotaCanBeSet(10, 10)).not.toThrow();
  });

  it("menolak kuota lebih kecil dari pemakaian", () => {
    expect(() => assertQuotaCanBeSet(9, 10)).toThrowError(
      expect.objectContaining({ code: "QUOTA_BELOW_USAGE" }),
    );
  });

  it("mengizinkan kuota tanpa batas", () => {
    expect(() => assertQuotaCanBeSet(null, 500)).not.toThrow();
  });

  it("menolak fallback ke jalur yang sama", () => {
    expect(() => assertFallbackIsNotSelf("jalur-1", "jalur-1")).toThrow(
      MasterDataError,
    );
  });
});

