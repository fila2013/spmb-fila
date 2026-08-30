import { NextResponse } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
import { admissionErrorResponse } from "@/lib/admission/http";
import { MAX_DU_PROOF_BYTES } from "@/lib/admission/rules";
import { admissionIdSchema } from "@/lib/admission/schemas";
import {
  getAdmissionFeePageData,
  uploadAdmissionFeeProof,
} from "@/lib/admission/service";
import { AdmissionError } from "@/lib/admission/errors";
import { requireRole } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const wali = await requireRole(UserRole.WALI_MURID);
    const id = admissionIdSchema.parse((await params).id);
    return NextResponse.json({ data: await getAdmissionFeePageData(id, wali.userId) });
  } catch (error) {
    return admissionErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const wali = await requireRole(UserRole.WALI_MURID);
    const id = admissionIdSchema.parse((await params).id);
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_DU_PROOF_BYTES + 512 * 1024) {
      throw new AdmissionError("FILE_TOO_LARGE", "Bukti pembayaran maksimal 5 MB.", 413);
    }
    const formData = await request.formData();
    const file = formData.get("bukti");
    if (!(file instanceof File)) {
      throw new AdmissionError("FILE_REQUIRED", "Pilih bukti pembayaran DU.", 422);
    }
    const payment = await uploadAdmissionFeeProof(id, wali.userId, file);
    return NextResponse.json(
      { data: { id: payment.id, status: payment.status, createdAt: payment.createdAt } },
      { status: 201 },
    );
  } catch (error) {
    return admissionErrorResponse(error);
  }
}
