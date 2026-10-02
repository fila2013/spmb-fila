import type {
  StatusAssessment,
  StatusKeseluruhan,
  StatusPengumuman,
} from "@/generated/prisma/enums";

export type StageActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  quickEdit?: {
    nextStatus: StatusKeseluruhan;
    deleted?: boolean;
    assessment?: { status: StatusAssessment; catatan: string | null };
    announcement?: { statusAkhir: StatusPengumuman | null; tanggalRilis: string };
  };
};

export const initialStageActionState: StageActionState = { status: "idle" };
