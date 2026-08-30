import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  JenisPembayaran,
  StatusAssessment,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { createCsv, createXlsx, type ReportRow } from "@/lib/reporting/export";
import {
  announcementLabels,
  assessmentLabels,
  overallStatusLabel,
  paymentLabels,
  subCategoryLabels,
  whatsappLabels,
} from "@/lib/reporting/labels";
import { currentPayment, enrollmentStatus, matchesOperationalFilters } from "@/lib/reporting/rules";
import type { ReportingExportInput, ReportingFilters } from "@/lib/reporting/schemas";

const participantInclude = {
  user: { select: { email: true } },
  jalur: { select: { nama: true } },
  jalurAsal: { select: { nama: true } },
  kategori: { select: { nama: true } },
  hasilAssessment: { select: { status: true } },
  pengumuman: { select: { statusAkhir: true, tanggalRilis: true } },
  statusGrupWa: { select: { status: true } },
  pembayaran: {
    select: { jenis: true, status: true, nominal: true, verifiedAt: true },
    orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
  },
} satisfies Prisma.CalonMuridInclude;

type Participant = Prisma.CalonMuridGetPayload<{ include: typeof participantInclude }>;

function databaseFilters(filters: ReportingFilters): Prisma.CalonMuridWhereInput {
  return {
    ...(filters.q ? {
      OR: [
        { namaAnak: { contains: filters.q, mode: "insensitive" } },
        { user: { email: { contains: filters.q, mode: "insensitive" } } },
      ],
    } : {}),
    ...(filters.jalurId ? { jalurId: filters.jalurId } : {}),
    ...(filters.kategoriId ? { kategoriId: filters.kategoriId } : {}),
    ...(filters.statusKeseluruhan ? { statusKeseluruhan: filters.statusKeseluruhan } : {}),
  };
}

export async function listReportParticipants(filters: ReportingFilters) {
  const participants = await prisma.calonMurid.findMany({
    where: databaseFilters(filters),
    include: participantInclude,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return participants.filter((participant) => matchesOperationalFilters(participant, filters));
}

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formattedDate(value: Date | null | undefined) {
  return value ? dateFormatter.format(value) : "";
}

export function participantToReportRow(participant: Participant): ReportRow {
  const registration = currentPayment(participant.pembayaran, JenisPembayaran.PENDAFTARAN);
  const du = currentPayment(participant.pembayaran, JenisPembayaran.DU);
  const subcategory = participant.subKategoriEnum
    ? subCategoryLabels[participant.subKategoriEnum]
    : participant.subKategoriText ?? "";
  return {
    "ID Peserta": participant.id,
    "Nama Calon Murid": participant.namaAnak,
    "Email Wali": participant.user.email,
    "Jalur": participant.jalur?.nama ?? "",
    "Jalur Asal": participant.jalurAsal?.nama ?? "",
    "Kategori": participant.kategori?.nama ?? "",
    "Subkategori": subcategory,
    "Status Keseluruhan": overallStatusLabel(participant.statusKeseluruhan),
    "Status Enrollment": enrollmentStatus(participant.statusKeseluruhan) === "LENGKAP" ? "Lengkap" : "Belum lengkap",
    "Status Pembayaran Pendaftaran": registration ? paymentLabels[registration.status] : "Belum ada",
    "Nominal Pendaftaran": registration?.nominal ?? "",
    "Verifikasi Pendaftaran": formattedDate(registration?.verifiedAt),
    "Status Assessment": assessmentLabels[participant.hasilAssessment?.status ?? StatusAssessment.BELUM],
    "Hasil Pengumuman": participant.pengumuman?.statusAkhir ? announcementLabels[participant.pengumuman.statusAkhir] : "Menunggu",
    "Tanggal Rilis": formattedDate(participant.pengumuman?.tanggalRilis),
    "Status DU": du ? paymentLabels[du.status] : "Belum ada",
    "Nominal DU": du?.nominal ?? "",
    "Verifikasi DU": formattedDate(du?.verifiedAt),
    "Status Grup WhatsApp": participant.statusGrupWa ? whatsappLabels[participant.statusGrupWa.status] : "Belum ada",
    "Tanggal Mendaftar": formattedDate(participant.createdAt),
  };
}

export async function createParticipantReport(input: ReportingExportInput, actorId: string) {
  const participants = await listReportParticipants(input);
  const rows = participants.map(participantToReportRow);
  const body = input.format === "csv" ? createCsv(rows) : await createXlsx(rows);
  await prisma.auditLog.create({
    data: {
      actorId,
      action: "EXPORT_PARTICIPANT_REPORT",
      entity: "laporan",
      detail: {
        format: input.format,
        rowCount: rows.length,
        filters: {
          hasSearch: Boolean(input.q),
          jalurId: input.jalurId ?? null,
          kategoriId: input.kategoriId ?? null,
          statusKeseluruhan: input.statusKeseluruhan ?? null,
          statusPembayaran: input.statusPembayaran ?? null,
          statusEnrollment: input.statusEnrollment ?? null,
          statusAssessment: input.statusAssessment ?? null,
          statusKelulusan: input.statusKelulusan ?? null,
          statusDu: input.statusDu ?? null,
          statusWa: input.statusWa ?? null,
        },
      },
    },
  });
  return { body, rowCount: rows.length };
}
