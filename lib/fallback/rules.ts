import { FallbackError } from "@/lib/fallback/errors";

export type QuotaState = {
  kuotaMaks: number | null;
  kuotaTerpakai: number;
};

export function hasQuotaCapacity(quota: QuotaState) {
  return quota.kuotaMaks === null || quota.kuotaTerpakai < quota.kuotaMaks;
}

export function isQuotaCapacityIncreased(
  previous: number | null,
  next: number | null,
) {
  if (previous === null) return false;
  if (next === null) return true;
  return next > previous;
}

export function deletionConfirmation(name: string) {
  return `HAPUS ${name}`;
}

export function assertDeletionConfirmed(
  name: string,
  confirmation: string | null | undefined,
) {
  if (confirmation !== deletionConfirmation(name)) {
    throw new FallbackError(
      "AUTO_DELETE_CONFIRMATION_REQUIRED",
      `Ketik \"${deletionConfirmation(name)}\" untuk mengonfirmasi penghapusan permanen.`,
      409,
    );
  }
}
