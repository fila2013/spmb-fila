export type JalurSelectionState = {
  id: string;
  fallbackJalurId: string | null;
  pilihanJalurFinalTargetId: string | null;
};

export type MasterDataActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  savedJalurSelection?: JalurSelectionState;
};

export const initialMasterDataActionState: MasterDataActionState = {
  status: "idle",
};

export function latestJalurSelection(
  databaseValue: JalurSelectionState | undefined,
  savedValue: JalurSelectionState | undefined,
) {
  return databaseValue && savedValue?.id === databaseValue.id
    ? savedValue
    : databaseValue;
}
