import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import { createParticipantEnrollmentPdf } from "@/lib/enrollment/pdf-service";
import { stageErrorResponse } from "@/lib/stages/http";
import { stageIdSchema } from "@/lib/stages/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const childId = stageIdSchema.parse((await params).id);
    const pdf = await createParticipantEnrollmentPdf(childId, admin.userId);
    return new Response(Uint8Array.from(pdf.body).buffer, {
      headers: {
        "cache-control": "private, no-store, max-age=0",
        "content-disposition": `attachment; filename="${pdf.filename}"`,
        "content-type": "application/pdf",
        "x-content-type-options": "nosniff",
        "x-pdf-page-count": String(pdf.pageCount),
      },
    });
  } catch (error) {
    return stageErrorResponse(error);
  }
}
