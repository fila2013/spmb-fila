export type CalonMuridErrorCode =
  | "NOT_FOUND"
  | "INVALID_STAGE"
  | "CLOSED"
  | "QUOTA_FULL"
  | "FEE_NOT_CONFIGURED"
  | "INTEGRITY_ERROR";

export class CalonMuridError extends Error {
  constructor(
    public readonly code: CalonMuridErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "CalonMuridError";
  }
}
