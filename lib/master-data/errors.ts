export type MasterDataErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "QUOTA_BELOW_USAGE"
  | "INVALID_FALLBACK"
  | "INVALID_FINAL_ROUTE_TARGET";

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
