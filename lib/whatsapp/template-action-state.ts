import type { WhatsappTemplateInput } from "@/lib/whatsapp/template-schema";
import type { WhatsappTemplateRecord } from "@/lib/whatsapp/templates";

export type WhatsappTemplateActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<keyof WhatsappTemplateInput, string[]>>;
  template?: WhatsappTemplateRecord;
};

export const initialWhatsappTemplateActionState: WhatsappTemplateActionState = { status: "idle" };
