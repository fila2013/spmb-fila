export type AdminDeletionActionState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialAdminDeletionActionState: AdminDeletionActionState = {
  status: "idle",
};
