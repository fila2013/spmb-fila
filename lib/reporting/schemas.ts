import { z } from "zod";

import {
  StatusAssessment,
  StatusKeseluruhan,
  StatusPembayaran,
  StatusPengumuman,
  StatusUndanganWa,
} from "@/generated/prisma/enums";

const emptyToUndefined = (value: unknown) => value === "" ? undefined : value;
const optionalUuid = z.preprocess(emptyToUndefined, z.uuid("ID filter tidak valid.").optional());
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(emptyToUndefined, z.enum(values).optional());

const overallStatuses = Object.values(StatusKeseluruhan) as [StatusKeseluruhan, ...StatusKeseluruhan[]];
const paymentStatuses = Object.values(StatusPembayaran) as [StatusPembayaran, ...StatusPembayaran[]];
const assessmentStatuses = Object.values(StatusAssessment) as [StatusAssessment, ...StatusAssessment[]];
const announcementStatuses = Object.values(StatusPengumuman) as [StatusPengumuman, ...StatusPengumuman[]];
const whatsappStatuses = Object.values(StatusUndanganWa) as [StatusUndanganWa, ...StatusUndanganWa[]];

export const reportingFilterSchema = z.object({
  q: z.preprocess(
    emptyToUndefined,
    z.string().trim().min(1).max(100).optional(),
  ),
  jalurId: optionalUuid,
  kategoriId: optionalUuid,
  statusKeseluruhan: optionalEnum(overallStatuses),
  statusPembayaran: optionalEnum(["BELUM_ADA", ...paymentStatuses]),
  statusEnrollment: optionalEnum(["BELUM_LENGKAP", "LENGKAP"]),
  statusAssessment: optionalEnum(assessmentStatuses),
  statusKelulusan: optionalEnum(["MENUNGGU", ...announcementStatuses]),
  statusDu: optionalEnum(["BELUM_ADA", ...paymentStatuses]),
  statusWa: optionalEnum(["BELUM_ADA", ...whatsappStatuses]),
});

export const reportingExportSchema = reportingFilterSchema.extend({
  format: z.preprocess(emptyToUndefined, z.enum(["csv", "xlsx"]).default("xlsx")),
});

export type ReportingFilters = z.infer<typeof reportingFilterSchema>;
export type ReportingExportInput = z.infer<typeof reportingExportSchema>;

export function searchParamsRecord(searchParams: URLSearchParams) {
  return Object.fromEntries(searchParams.entries());
}

export function pageSearchParamsRecord(
  searchParams: Record<string, string | string[] | undefined>,
) {
  return Object.fromEntries(
    Object.entries(searchParams).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );
}
