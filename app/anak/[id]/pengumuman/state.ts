export type FinalRouteChoiceActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const initialFinalRouteChoiceActionState: FinalRouteChoiceActionState = {
  status: "idle",
};
