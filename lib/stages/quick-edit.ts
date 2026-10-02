import type {
  StatusAssessment,
  StatusKeseluruhan,
  StatusPengumuman,
} from "@/generated/prisma/enums";
import type { StageActionState } from "@/lib/stages/action-state";

export type QuickEditParticipant = {
  id: string;
  namaAnak: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  jalurKategori: string;
  statusKeseluruhan: StatusKeseluruhan;
  assessmentStatus: StatusAssessment;
  assessmentNote: string;
  announcementStatus: StatusPengumuman | null;
  releaseDate: string;
  announcementLocked: boolean;
  requiresDeleteConfirmation: boolean;
  finalRouteChoiceEnabled: boolean;
};

export function applyQuickEditResult(
  participants: QuickEditParticipant[],
  id: string,
  result: NonNullable<StageActionState["quickEdit"]>,
  filteredStatus: StatusKeseluruhan | null,
) {
  if (result.deleted) return participants.filter((item) => item.id !== id);
  return participants.flatMap((item) => {
    if (item.id !== id) return [item];
    if (filteredStatus && result.nextStatus !== filteredStatus) return [];
    return [{
      ...item,
      statusKeseluruhan: result.nextStatus,
      assessmentStatus: result.assessment?.status ?? item.assessmentStatus,
      assessmentNote: result.assessment
        ? result.assessment.catatan ?? ""
        : item.assessmentNote,
      announcementStatus: result.announcement
        ? result.announcement.statusAkhir
        : item.announcementStatus,
      releaseDate: result.announcement?.tanggalRilis ?? item.releaseDate,
      announcementLocked: item.announcementLocked ||
        result.nextStatus === "MENUNGGU_PILIHAN_JALUR" ||
        result.nextStatus === "MENUNGGU_KUOTA_FALLBACK",
    }];
  });
}
