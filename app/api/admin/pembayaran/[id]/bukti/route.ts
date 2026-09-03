import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import { calonMuridIdSchema } from "@/lib/calon-murid/schemas";
import { paymentErrorResponse } from "@/lib/payment/http";
import { downloadPaymentProof } from "@/lib/payment/service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole(UserRole.ADMIN);
    const id = calonMuridIdSchema.parse((await params).id);
    const { blob, filename } = await downloadPaymentProof(id);
    return new Response(blob, {
      headers: {
        "Content-Type": blob.type || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return paymentErrorResponse(error);
  }
}
