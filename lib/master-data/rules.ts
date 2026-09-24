import { MasterDataError } from "@/lib/master-data/errors";

export function assertQuotaCanBeSet(
  quotaMaks: number | null,
  kuotaTerpakai: number,
  kuotaDitahan = 0,
) {
  if (quotaMaks !== null && quotaMaks < kuotaTerpakai + kuotaDitahan) {
    throw new MasterDataError(
      "QUOTA_BELOW_USAGE",
      "Kuota maksimum tidak boleh lebih kecil dari total kuota terverifikasi dan hold pembayaran aktif.",
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

export function assertFinalChoiceTargetIsNotSelf(
  jalurId: string,
  targetJalurId: string | null,
) {
  if (targetJalurId === jalurId) {
    throw new MasterDataError(
      "INVALID_FINAL_ROUTE_TARGET",
      "Jalur tujuan pilihan final harus berbeda dari jalur asal.",
      422,
    );
  }
}
