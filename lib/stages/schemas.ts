import { z } from "zod";

import {
  StatusAssessment,
  StatusKeseluruhan,
  StatusPengumuman,
  TahapKonten,
} from "@/generated/prisma/enums";
import { youtubeVideoId } from "@/lib/stages/rules";

const uuid = z.uuid("ID tidak valid.");
const optionalUuid = z.preprocess((value) => value === "" ? null : value, uuid.nullable());
const optionalFilterUuid = z.preprocess(
  (value) => value === "" ? undefined : value,
  uuid.optional(),
);
const overallStatuses = Object.values(StatusKeseluruhan) as [
  StatusKeseluruhan,
  ...StatusKeseluruhan[],
];
const optionalOverallStatus = z.preprocess(
  (value) => value === "" ? undefined : value,
  z.enum(overallStatuses).optional(),
);
const optionalDate = z.preprocess(
  (value) => value === "" ? null : value,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid.").nullable(),
);
const optionalText = (max: number) => z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  z.string().trim().max(max).nullable(),
);
const optionalYoutubeVideoId = z.preprocess(
  (value) => {
    if (typeof value !== "string" || value.trim() === "") return null;
    return youtubeVideoId(value) ?? value;
  },
  z.string().regex(/^[A-Za-z0-9_-]{11}$/, "Link YouTube tidak valid.").nullable(),
);
const optionalParticipantOrder = z.preprocess(
  (value) => value === "" || value === undefined ? null : value,
  z.coerce.number().int("Urutan peserta harus bilangan bulat.").min(1, "Urutan peserta minimal 1.").max(2_147_483_647, "Urutan peserta terlalu besar.").nullable(),
);

export const stageIdSchema = uuid;
export const participantListFilterSchema = z.object({
  q: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().min(1).max(100).optional(),
  ),
  jalurId: optionalFilterUuid,
  kategoriId: optionalFilterUuid,
  statusKeseluruhan: optionalOverallStatus,
});
export const stageTypeSchema = z.enum([
  TahapKonten.HOME,
  TahapKonten.ASSESSMENT,
  TahapKonten.ANNOUNCEMENT,
  TahapKonten.ADMISSION_FEE,
  TahapKonten.JOIN_WA,
]);
export const participantStageTypeSchema = z.enum([
  TahapKonten.ASSESSMENT,
  TahapKonten.ANNOUNCEMENT,
  TahapKonten.ADMISSION_FEE,
  TahapKonten.JOIN_WA,
]);
export const stageTypeParamSchema = z
  .string()
  .transform((value) => value.toUpperCase().replaceAll("-", "_"))
  .pipe(stageTypeSchema);
export const participantStageTypeParamSchema = z
  .string()
  .transform((value) => value.toUpperCase().replaceAll("-", "_"))
  .pipe(participantStageTypeSchema);

export const stageContentInputSchema = z.object({
  tahap: stageTypeSchema,
  judul: z.string().trim().min(1, "Judul wajib diisi.").max(200),
  tanggal: optionalDate,
  isiTeks: optionalText(10_000),
  gambarUrl: optionalText(2_000).default(null),
  youtubeVideoId: optionalYoutubeVideoId.default(null),
  urutanLayout: z.coerce.number().int().min(0).max(10_000),
  minParticipantOrder: optionalParticipantOrder,
  maxParticipantOrder: optionalParticipantOrder,
  statusAktif: z.boolean(),
  jalurId: optionalUuid,
  kategoriId: optionalUuid,
}).refine(
  ({ minParticipantOrder, maxParticipantOrder }) =>
    minParticipantOrder === null || maxParticipantOrder === null || minParticipantOrder <= maxParticipantOrder,
  { path: ["maxParticipantOrder"], message: "Maksimal urutan peserta tidak boleh lebih kecil dari minimal." },
).refine(
  ({ tahap, minParticipantOrder, maxParticipantOrder }) =>
    tahap !== TahapKonten.HOME || (minParticipantOrder === null && maxParticipantOrder === null),
  { path: ["minParticipantOrder"], message: "Rentang urutan peserta tidak berlaku untuk konten beranda." },
);

export const updateStageContentSchema = stageContentInputSchema.safeExtend({ id: uuid });
export const deleteStageContentSchema = z.object({
  id: uuid,
  confirmation: z.literal("HAPUS"),
});

export const assessmentInputSchema = z.object({
  status: z.enum([
    StatusAssessment.BELUM,
    StatusAssessment.HADIR,
    StatusAssessment.TIDAK_HADIR,
  ]),
  catatan: optionalText(5_000),
});

export const announcementInputSchema = z.object({
  statusAkhir: z.enum([
    StatusPengumuman.DITERIMA,
    StatusPengumuman.TIDAK_DITERIMA,
  ]),
  tanggalRilis: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal rilis wajib diisi."),
  deletionConfirmation: z.preprocess(
    (value) => typeof value === "string" && value === "" ? null : value,
    z.string().max(200).nullable().optional(),
  ),
});

export type StageContentInput = z.infer<typeof stageContentInputSchema>;
export type ParticipantListFilters = z.infer<typeof participantListFilterSchema>;
export type UpdateStageContentInput = z.infer<typeof updateStageContentSchema>;
export type AssessmentInput = z.infer<typeof assessmentInputSchema>;
export type AnnouncementInput = z.infer<typeof announcementInputSchema>;
