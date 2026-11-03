import "server-only";

import { prisma } from "@/lib/prisma";
import { whatsappTemplateSchema, type WhatsappTemplateInput } from "@/lib/whatsapp/template-schema";
import type { WhatsappTemplateRecord, WhatsappTemplateSummary } from "@/lib/whatsapp/templates";

const templateSummarySelect = { id: true, judul: true, kategori: true, isiPesan: true } as const;
const templateRecordSelect = { ...templateSummarySelect, statusAktif: true } as const;

export function listActiveWhatsappTemplates(): Promise<WhatsappTemplateSummary[]> {
  return prisma.templatePesanWhatsapp.findMany({
    where: { statusAktif: true },
    select: templateSummarySelect,
    orderBy: [{ kategori: "asc" }, { judul: "asc" }, { id: "asc" }],
  });
}

export function listWhatsappTemplates(): Promise<WhatsappTemplateRecord[]> {
  return prisma.templatePesanWhatsapp.findMany({
    select: templateRecordSelect,
    orderBy: [{ statusAktif: "desc" }, { kategori: "asc" }, { judul: "asc" }, { id: "asc" }],
  });
}

export function saveWhatsappTemplate(input: WhatsappTemplateInput, actorId: string): Promise<WhatsappTemplateRecord> {
  const { id, ...values } = whatsappTemplateSchema.parse(input);
  const data = { ...values, updatedById: actorId };
  return prisma.$transaction(async (tx) => {
    const saved = id
      ? await tx.templatePesanWhatsapp.update({ where: { id }, data, select: templateRecordSelect })
      : await tx.templatePesanWhatsapp.create({ data, select: templateRecordSelect });
    await tx.auditLog.create({ data: {
      actorId,
      action: id ? "UPDATE_WHATSAPP_TEMPLATE" : "CREATE_WHATSAPP_TEMPLATE",
      entity: "template_pesan_whatsapp",
      entityId: saved.id,
      detail: { kategori: saved.kategori, statusAktif: saved.statusAktif },
    } });
    return saved;
  });
}
