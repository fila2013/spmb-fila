export type CalonMuridActionState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialCalonMuridActionState: CalonMuridActionState = {
  status: "idle",
};
