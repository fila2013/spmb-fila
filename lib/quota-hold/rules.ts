import { StatusHoldKuota } from "@/generated/prisma/enums";

export const DEFAULT_HOLD_DURATION_MINUTES = 24 * 60;
export const MIN_HOLD_DURATION_MINUTES = 5;
export const MAX_HOLD_DURATION_MINUTES = 7 * 24 * 60;

export const CRITICAL_QUOTA_HOLD_MESSAGE =
  "Mohon maaf, kuota terakhir sedang dalam proses pembayaran oleh pendaftar lain. Silakan tunggu beberapa saat atau coba kembali nanti.";

export type QuotaWithHolds = {
  kuotaMaks: number | null;
  kuotaTerpakai: number;
  kuotaDitahan?: number;
};

export function remainingQuota(quota: QuotaWithHolds) {
  if (quota.kuotaMaks === null) return null;
  return Math.max(
    quota.kuotaMaks - quota.kuotaTerpakai - (quota.kuotaDitahan ?? 0),
    0,
  );
}

export function quotaBlockingReason(quota: QuotaWithHolds) {
  if (quota.kuotaMaks === null) return null;
  if (quota.kuotaTerpakai >= quota.kuotaMaks) return "FULL" as const;
  if (
    quota.kuotaTerpakai + (quota.kuotaDitahan ?? 0) >=
    quota.kuotaMaks
  ) {
    return "HELD" as const;
  }
  return null;
}

export function isActivePendingHold(
  hold: { status: StatusHoldKuota; expiresAt: Date } | null | undefined,
  now = new Date(),
) {
  return Boolean(
    hold?.status === StatusHoldKuota.PENDING_PAYMENT &&
      hold.expiresAt.getTime() > now.getTime(),
  );
}

export function holdExpiry(
  durationMinutes: number,
  now = new Date(),
) {
  return new Date(now.getTime() + durationMinutes * 60_000);
}

export function remainingHoldMinutes(expiresAt: Date, now = new Date()) {
  return Math.max(
    0,
    Math.ceil((expiresAt.getTime() - now.getTime()) / 60_000),
  );
}
