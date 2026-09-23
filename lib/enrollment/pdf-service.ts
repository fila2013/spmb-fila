import "server-only";

import { FormType } from "@/generated/prisma/enums";
import { createEnrollmentPdf } from "@/lib/enrollment/pdf";
import { prisma } from "@/lib/prisma";
import { StageError } from "@/lib/stages/errors";

export async function createParticipantEnrollmentPdf(
  childId: string,
  actorId: string,
) {
  const participant = await prisma.calonMurid.findUnique({
    where: { id: childId },
    select: {
      id: true,
      namaAnak: true,
      user: { select: { email: true } },
      jalur: { select: { nama: true } },
      kategori: { select: { nama: true } },
      formResponses: {
        select: {
          id: true,
          value: true,
          field: {
            select: {
              formType: true,
              label: true,
              urutan: true,
            },
          },
        },
      },
    },
  });
  if (!participant) {
    throw new StageError("NOT_FOUND", "Peserta tidak ditemukan.", 404);
  }

  const responses = participant.formResponses.map((response) => ({
    id: response.id,
    label: response.field.label,
    value: response.value,
    formType: response.field.formType,
    order: response.field.urutan,
  }));
  const result = await createEnrollmentPdf({
    id: participant.id,
    childName: participant.namaAnak,
    guardianEmail: participant.user.email,
    routeName: participant.jalur?.nama ?? null,
    categoryName: participant.kategori?.nama ?? null,
    responses,
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: "EXPORT_PARTICIPANT_ENROLLMENT_PDF",
      entity: "calon_murid",
      entityId: participant.id,
      detail: {
        personalResponseCount: responses.filter(
          (response) => response.formType === FormType.DATA_PRIBADI,
        ).length,
        observationResponseCount: responses.filter(
          (response) => response.formType === FormType.OBSERVASI,
        ).length,
        pageCount: result.pageCount,
      },
    },
  });

  return result;
}
