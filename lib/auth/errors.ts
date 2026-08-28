export type AuthorizationErrorCode =
  | "UNAUTHENTICATED"
  | "PROFILE_NOT_FOUND"
  | "INACTIVE_PROFILE"
  | "FORBIDDEN"
  | "RESOURCE_NOT_FOUND";

export class AuthorizationError extends Error {
  constructor(
    public readonly code: AuthorizationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

