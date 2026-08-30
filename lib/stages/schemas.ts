import { z } from "zod";

import {
  StatusAssessment,
  StatusPengumuman,
  TahapKonten,
} from "@/generated/prisma/enums";

const uuid = z.uuid("ID tidak valid.");
const optionalUuid = z.preprocess((value) => value === "" ? null : value, uuid.nullable());
const optionalDate = z.preprocess(
  (value) => value === "" ? null : value,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid.").nullable(),
);
const optionalText = (max: number) => z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  z.string().trim().max(max).nullable(),
);

export const stageIdSchema = uuid;
export const stageTypeSchema = z.enum([
  TahapKonten.ASSESSMENT,
  TahapKonten.ANNOUNCEMENT,
  TahapKonten.ADMISSION_FEE,
  TahapKonten.JOIN_WA,
]);
export const stageTypeParamSchema = z
  .string()
  .transform((value) => value.toUpperCase().replaceAll("-", "_"))
  .pipe(stageTypeSchema);

export const stageContentInputSchema = z.object({
  tahap: stageTypeSchema,
  judul: z.string().trim().min(1, "Judul wajib diisi.").max(200),
  tanggal: optionalDate,
  isiTeks: optionalText(10_000),
  gambarUrl: optionalText(2_000).default(null),
  urutanLayout: z.coerce.number().int().min(0).max(10_000),
  statusAktif: z.boolean(),
  jalurId: optionalUuid,
  kategoriId: optionalUuid,
});

export const updateStageContentSchema = stageContentInputSchema.extend({ id: uuid });

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
export type UpdateStageContentInput = z.infer<typeof updateStageContentSchema>;
export type AssessmentInput = z.infer<typeof assessmentInputSchema>;
export type AnnouncementInput = z.infer<typeof announcementInputSchema>;
