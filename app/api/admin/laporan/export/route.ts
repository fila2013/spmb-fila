import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import { reportingErrorResponse } from "@/lib/reporting/http";
import { reportingExportSchema, searchParamsRecord } from "@/lib/reporting/schemas";
import { createParticipantReport } from "@/lib/reporting/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reportDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET(request: Request) {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const url = new URL(request.url);
    const input = reportingExportSchema.parse(searchParamsRecord(url.searchParams));
    const report = await createParticipantReport(input, admin.userId);
    const extension = input.format;
    const contentType = input.format === "csv"
      ? "text/csv; charset=utf-8"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    return new Response(report.body, {
      headers: {
        "cache-control": "private, no-store, max-age=0",
        "content-disposition": `attachment; filename="rekap-peserta-${reportDate()}.${extension}"`,
        "content-type": contentType,
        "x-content-type-options": "nosniff",
        "x-report-row-count": String(report.rowCount),
      },
    });
  } catch (error) {
    return reportingErrorResponse(error);
  }
}
