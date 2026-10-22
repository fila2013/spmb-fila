import type {
  StatusAssessment,
  StatusKeseluruhan,
  StatusPengumuman,
} from "@/generated/prisma/enums";
import type { AnnouncementTemplates } from "@/lib/stages/announcement-letter";

export type StageActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  templates?: AnnouncementTemplates;
  quickEdit?: {
    nextStatus: StatusKeseluruhan;
    deleted?: boolean;
    assessment?: { status: StatusAssessment; catatan: string | null };
    announcement?: { statusAkhir: StatusPengumuman | null; tanggalRilis: string };
  };
};

export const initialStageActionState: StageActionState = { status: "idle" };
