import { MasterDataError } from "@/lib/master-data/errors";

export function assertQuotaCanBeSet(
  quotaMaks: number | null,
  kuotaTerpakai: number,
) {
  if (quotaMaks !== null && quotaMaks < kuotaTerpakai) {
    throw new MasterDataError(
      "QUOTA_BELOW_USAGE",
      "Kuota maksimum tidak boleh lebih kecil dari kuota terpakai.",
      422,
    );
  }
}

export function assertFallbackIsNotSelf(
  jalurId: string,
  fallbackJalurId: string | null,
) {
  if (fallbackJalurId === jalurId) {
    throw new MasterDataError(
      "INVALID_FALLBACK",
      "Jalur tidak boleh menjadi fallback untuk dirinya sendiri.",
      422,
    );
  }
}

