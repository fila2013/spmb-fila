export type EnrollmentActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialEnrollmentActionState: EnrollmentActionState = {
  status: "idle",
};
