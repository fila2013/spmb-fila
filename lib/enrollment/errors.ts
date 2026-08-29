export class EnrollmentError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "EnrollmentError";
  }
}

export class EnrollmentValidationError extends EnrollmentError {
  constructor(public readonly fieldErrors: Record<string, string[]>) {
    super(
      "VALIDATION_ERROR",
      "Periksa kembali jawaban formulir enrollment.",
      422,
    );
    this.name = "EnrollmentValidationError";
  }
}
