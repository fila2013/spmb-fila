import { describe, expect, it } from "vitest";

import { StatusHoldKuota } from "@/generated/prisma/enums";
import {
  holdExpiry,
  isActivePendingHold,
  quotaBlockingReason,
  remainingHoldMinutes,
  remainingQuota,
} from "@/lib/quota-hold/rules";

describe("registration quota hold rules", () => {
  it("memisahkan kuota verified dan hold aktif", () => {
    expect(
      remainingQuota({ kuotaMaks: 5, kuotaTerpakai: 2, kuotaDitahan: 2 }),
    ).toBe(1);
    expect(
      quotaBlockingReason({
        kuotaMaks: 5,
        kuotaTerpakai: 4,
        kuotaDitahan: 1,
      }),
    ).toBe("HELD");
    expect(
      quotaBlockingReason({
        kuotaMaks: 5,
        kuotaTerpakai: 5,
        kuotaDitahan: 0,
      }),
    ).toBe("FULL");
  });

  it("mengabaikan batas untuk kuota tanpa batas", () => {
    expect(
      remainingQuota({
        kuotaMaks: null,
        kuotaTerpakai: 500,
        kuotaDitahan: 500,
      }),
    ).toBeNull();
    expect(
      quotaBlockingReason({
        kuotaMaks: null,
        kuotaTerpakai: 500,
        kuotaDitahan: 500,
      }),
    ).toBeNull();
  });

  it("hold hanya aktif sebelum expiresAt", () => {
    const now = new Date("2026-09-22T00:00:00.000Z");
    expect(
      isActivePendingHold(
        {
          status: StatusHoldKuota.PENDING_PAYMENT,
          expiresAt: new Date("2026-09-22T00:01:00.000Z"),
        },
        now,
      ),
    ).toBe(true);
    expect(
      isActivePendingHold(
        {
          status: StatusHoldKuota.PENDING_PAYMENT,
          expiresAt: now,
        },
        now,
      ),
    ).toBe(false);
  });

  it("menghitung expiry dan sisa menit secara deterministik", () => {
    const now = new Date("2026-09-22T00:00:00.000Z");
    const expiresAt = holdExpiry(1440, now);
    expect(expiresAt.toISOString()).toBe("2026-09-23T00:00:00.000Z");
    expect(remainingHoldMinutes(expiresAt, now)).toBe(1440);
    expect(
      remainingHoldMinutes(
        new Date("2026-09-22T00:05:59.000Z"),
        now,
      ),
    ).toBe(6);
  });
});
