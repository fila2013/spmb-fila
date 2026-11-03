import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { FormType, StatusKeseluruhan } from "@/generated/prisma/enums";
import { statusPresentation } from "@/lib/calon-murid/presentation";
import {
  guardianRoleForPhoneField,
  normalizeWhatsAppForUrl,
  type GuardianContactRole,
} from "@/lib/enrollment/whatsapp-chat-url";
import { releasedStatusAfterAcceptedDecision } from "@/lib/final-route-choice/rules";
import { prisma } from "@/lib/prisma";
import { isAnnouncementReleased, mayViewAnnouncement } from "@/lib/stages/rules";
import { listActiveWhatsappTemplates } from "@/lib/whatsapp/template-service";
import type { WhatsappTemplateSummary } from "@/lib/whatsapp/templates";

type ParticipantWhatsappContact = {
  role: GuardianContactRole;
  name: string;
  number: string;
};

export type ParticipantWhatsappDraftsResult =
  | {
      ok: true;
      participantName: string;
      contacts: ParticipantWhatsappContact[];
      templates: WhatsappTemplateSummary[];
      values: { nama_peserta: string; jalur: string; kategori: string; status: string };
    }
  | { ok: false; message: string };

const contactLabels = [
  "Nama ayah", "Nama ibu", "Nama bunda",
  ...["No WA", "No. WA", "No WA.", "No. WA."].flatMap((prefix) =>
    ["ayah", "bunda", "ibu"].map((role) => `${prefix} ${role}`),
  ),
];

const participantDraftSelect = {
  namaAnak: true,
  statusKeseluruhan: true,
  jalur: { select: { nama: true, pilihanJalurFinalAktif: true, pilihanJalurFinalTargetId: true } },
  jalurAsal: { select: { nama: true } },
  menungguFallbackJalur: { select: { nama: true } },
  kategori: { select: { nama: true } },
  pengumuman: { select: { statusAkhir: true, tanggalRilis: true } },
  formResponses: {
    where: { field: { formType: FormType.DATA_PRIBADI, label: { in: contactLabels, mode: "insensitive" } } },
    select: { value: true, field: { select: { formType: true, label: true } } },
    orderBy: [{ field: { archivedAt: { sort: "asc", nulls: "first" } } }, { updatedAt: "desc" }, { id: "asc" }],
  },
} satisfies Prisma.CalonMuridSelect;

type ParticipantDraftData = Prisma.CalonMuridGetPayload<{ select: typeof participantDraftSelect }>;

function guardianRoleForNameField(field: ParticipantDraftData["formResponses"][number]["field"]): GuardianContactRole | null {
  if (field.formType !== FormType.DATA_PRIBADI) return null;
  const label = field.label.trim().toLowerCase().replace(/[.\s]+/g, " ");
  if (label === "nama ayah") return "ayah";
  if (label === "nama ibu" || label === "nama bunda") return "bunda";
  return null;
}

function participantContacts(answers: ParticipantDraftData["formResponses"]): ParticipantWhatsappContact[] {
  const numbers = new Map<GuardianContactRole, string>();
  const names = new Map<GuardianContactRole, string>();
  const seenPhoneRoles = new Set<GuardianContactRole>();

  for (const { field, value } of answers) {
    const text = value?.trim() ?? "";
    const phoneRole = guardianRoleForPhoneField(field);
    // Query order prioritizes current fields and newer responses. An invalid or
    // cleared current number must not revive an obsolete contact from history.
    if (phoneRole && !seenPhoneRoles.has(phoneRole)) {
      seenPhoneRoles.add(phoneRole);
      const number = normalizeWhatsAppForUrl(text);
      if (number) numbers.set(phoneRole, number);
    }
    const nameRole = guardianRoleForNameField(field);
    if (nameRole && !names.has(nameRole)) names.set(nameRole, text);
  }

  const roles: GuardianContactRole[] = ["ayah", "bunda"];
  return roles.flatMap((role) => {
    const number = numbers.get(role);
    return number ? [{ role, number, name: names.get(role) || (role === "ayah" ? "Bapak" : "Ibu") }] : [];
  });
}

function participantMessageValues(participant: ParticipantDraftData) {
  const { pengumuman, jalur, jalurAsal, menungguFallbackJalur } = participant;
  const released = Boolean(pengumuman?.statusAkhir && isAnnouncementReleased(pengumuman.tanggalRilis));
  const pendingPublication = mayViewAnnouncement(participant.statusKeseluruhan) && !released;
  let status = participant.statusKeseluruhan;

  // Messages leave the admin area. Never expand an unreleased decision, even
  // if a historical row is already in a decision-dependent stage.
  if (pendingPublication) {
    status = StatusKeseluruhan.MENUNGGU_PENGUMUMAN;
  } else if (released && pengumuman?.statusAkhir && jalur && status === StatusKeseluruhan.MENUNGGU_PENGUMUMAN) {
    // Release synchronization normally occurs on the wali page; project the
    // effective stage here without changing the participant's record.
    status = releasedStatusAfterAcceptedDecision({
      statusAkhir: pengumuman.statusAkhir,
      finalChoiceEnabled: jalur.pilihanJalurFinalAktif,
      finalChoiceTargetId: jalur.pilihanJalurFinalTargetId,
    });
  }

  const routeName = pendingPublication
    ? jalurAsal?.nama ?? (participant.statusKeseluruhan === StatusKeseluruhan.MENUNGGU_PENGUMUMAN ? jalur?.nama : null)
    : jalur?.nama ?? menungguFallbackJalur?.nama ?? jalurAsal?.nama;
  return {
    nama_peserta: participant.namaAnak,
    jalur: routeName ?? "Belum ditentukan",
    kategori: participant.kategori?.nama ?? "Belum ditentukan",
    status: statusPresentation[status].label,
  };
}

export async function getParticipantWhatsappDrafts(participantId: string): Promise<ParticipantWhatsappDraftsResult> {
  const participant = await prisma.calonMurid.findUnique({
    where: { id: participantId },
    select: participantDraftSelect,
  });
  if (!participant) return { ok: false, message: "Peserta tidak ditemukan." };

  return {
    ok: true,
    participantName: participant.namaAnak,
    contacts: participantContacts(participant.formResponses),
    templates: await listActiveWhatsappTemplates(),
    values: participantMessageValues(participant),
  };
}
