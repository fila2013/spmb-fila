export type MasterDataErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "QUOTA_BELOW_USAGE"
  | "INVALID_FALLBACK";

export class MasterDataError extends Error {
  constructor(
    public readonly code: MasterDataErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "MasterDataError";
  }
}

