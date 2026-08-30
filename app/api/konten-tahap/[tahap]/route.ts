import { NextResponse } from "next/server";

import { TahapKonten, UserRole } from "@/generated/prisma/enums";
import { AdmissionError } from "@/lib/admission/errors";
import { admissionErrorResponse } from "@/lib/admission/http";
import { getAdmissionFeePageData, getJoinWaPageData } from "@/lib/admission/service";
import { requireRole } from "@/lib/auth/session";
import { stageErrorResponse } from "@/lib/stages/http";
import { stageIdSchema, stageTypeParamSchema } from "@/lib/stages/schemas";
import { getAnnouncementForWali, getAssessmentForWali } from "@/lib/stages/service";

export async function GET(request: Request, { params }: { params: Promise<{ tahap: string }> }) {
  try {
    const wali = await requireRole(UserRole.WALI_MURID);
    const tahap = stageTypeParamSchema.parse((await params).tahap);
    const childId = stageIdSchema.parse(new URL(request.url).searchParams.get("calon_murid_id"));
    const data = tahap === TahapKonten.ASSESSMENT
      ? await getAssessmentForWali(childId, wali.userId)
      : tahap === TahapKonten.ANNOUNCEMENT
        ? await getAnnouncementForWali(childId, wali.userId)
        : tahap === TahapKonten.ADMISSION_FEE
          ? await getAdmissionFeePageData(childId, wali.userId)
          : await getJoinWaPageData(childId, wali.userId);
    return NextResponse.json({ data });
  } catch (error) {
    return error instanceof AdmissionError
      ? admissionErrorResponse(error)
      : stageErrorResponse(error);
  }
}
