import { FormType } from "@/generated/prisma/enums";
import { isIndonesianWhatsApp } from "@/lib/enrollment/rules";

export type GuardianContactRole = "ayah" | "bunda";

type EnrollmentAnswer = {
  field: { formType: FormType; label: string };
  value: string | null;
};

function normalizedLabel(label: string) {
  return label.trim().toLowerCase().replace(/[.\s]+/g, " ");
}

export function guardianRoleForPhoneField(
  field: EnrollmentAnswer["field"],
): GuardianContactRole | null {
  if (field.formType !== FormType.DATA_PRIBADI) return null;

  const label = normalizedLabel(field.label);
  if (label === "no wa ayah") return "ayah";
  if (label === "no wa bunda" || label === "no wa ibu") return "bunda";
  return null;
}

export function normalizeWhatsAppForUrl(value: string): string | null {
  const number = value.trim().replace(/[\s().-]/g, "");
  if (!isIndonesianWhatsApp(number)) return null;
  if (number.startsWith("+62")) return number.slice(1);
  return number.startsWith("62") ? number : `62${number.slice(1)}`;
}

export function createWhatsAppChatUrl(
  whatsappNumber: string,
  childName: string,
  message?: string | null,
): string | null {
  const phone = normalizeWhatsAppForUrl(whatsappNumber);
  const child = childName.trim();
  if (!phone || !child) return null;

  const text = message === undefined
    ? `Halo Bapak/Ibu Wali Murid ${child}, kami dari Panitia SPMB SDIT Fitrah Insani Langkapura.`
    : message?.trim();
  const baseUrl = `https://wa.me/${phone}`;
  return text ? `${baseUrl}?text=${encodeURIComponent(text)}` : baseUrl;
}

export function guardianWhatsAppUrlFromEnrollment(
  answers: EnrollmentAnswer[],
  role: GuardianContactRole,
  childName: string,
): string | null {
  const whatsappNumber = answers.find(
    ({ field }) => guardianRoleForPhoneField(field) === role,
  )?.value;

  return whatsappNumber
    ? createWhatsAppChatUrl(whatsappNumber, childName)
    : null;
}
