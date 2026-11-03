import { createWhatsAppChatUrl } from "@/lib/enrollment/whatsapp-chat-url";
import { whatsappTemplateVariables } from "@/lib/whatsapp/templates";

type WhatsappMessageKey = (typeof whatsappTemplateVariables)[number]["key"];
export type WhatsappMessageValues = Record<WhatsappMessageKey, string>;

const tokenKeys = new Map<string, WhatsappMessageKey>(whatsappTemplateVariables.map(({ token, key }) => [token, key]));

export function buildWhatsappDraft(template: string, number: string, values: WhatsappMessageValues) {
  // Substitute only tokens in the template. Data containing braces stays literal.
  const text = template.replace(/\{[a-z_]+\}/g, (token) => {
    const key = tokenKeys.get(token);
    return key ? values[key] : token;
  }).trim();
  return { text, url: text ? createWhatsAppChatUrl(number, values.nama_peserta, text) : null };
}
