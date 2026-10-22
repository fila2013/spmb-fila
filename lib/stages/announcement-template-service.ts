import "server-only";

import { prisma } from "@/lib/prisma";
import { ANNOUNCEMENT_TEMPLATE_ID, defaultAnnouncementTemplates } from "@/lib/stages/announcement-letter";
import { announcementTemplateSchema, type AnnouncementTemplateInput } from "@/lib/stages/schemas";

export async function getAnnouncementTemplates() {
  const saved = await prisma.templateSuratPengumuman.findUnique({
    where: { id: ANNOUNCEMENT_TEMPLATE_ID },
    select: { diterima: true, tidakDiterima: true },
  });
  return saved ?? { ...defaultAnnouncementTemplates };
}

export async function saveAnnouncementTemplates(input: AnnouncementTemplateInput, actorId: string) {
  const values = announcementTemplateSchema.parse(input);
  return prisma.$transaction(async (transaction) => {
    const saved = await transaction.templateSuratPengumuman.upsert({
      where: { id: ANNOUNCEMENT_TEMPLATE_ID },
      create: { id: ANNOUNCEMENT_TEMPLATE_ID, ...values, updatedById: actorId },
      update: { ...values, updatedById: actorId },
      select: { diterima: true, tidakDiterima: true },
    });
    await transaction.auditLog.create({ data: {
      actorId,
      action: "UPDATE_ANNOUNCEMENT_TEMPLATES",
      entity: "template_surat_pengumuman",
      detail: { after: saved },
    } });
    return saved;
  });
}
