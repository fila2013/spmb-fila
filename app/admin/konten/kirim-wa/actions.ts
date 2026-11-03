"use server";

import { revalidatePath } from "next/cache";

import { UserRole } from "@/generated/prisma/enums";
import { AuthorizationError } from "@/lib/auth/errors";
import { requireRole } from "@/lib/auth/session";
import type { WhatsappTemplateActionState } from "@/lib/whatsapp/template-action-state";
import { whatsappTemplateSchema } from "@/lib/whatsapp/template-schema";
import { saveWhatsappTemplate } from "@/lib/whatsapp/template-service";

export async function saveWhatsappTemplateAction(_state: WhatsappTemplateActionState, formData: FormData): Promise<WhatsappTemplateActionState> {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const parsed = whatsappTemplateSchema.safeParse({
      id: formData.get("id") ?? undefined,
      judul: formData.get("judul"),
      kategori: formData.get("kategori"),
      isiPesan: formData.get("isiPesan"),
      statusAktif: formData.get("statusAktif") === "on",
    });
    if (!parsed.success) {
      return { status: "error", message: "Periksa kembali data template.", fieldErrors: parsed.error.flatten().fieldErrors };
    }

    const template = await saveWhatsappTemplate(parsed.data, admin.userId);
    revalidatePath("/admin/konten/kirim-wa");
    revalidatePath("/admin/peserta");
    return { status: "success", message: "Template WhatsApp berhasil disimpan.", template };
  } catch (error) {
    return { status: "error", message: error instanceof AuthorizationError
      ? "Akses Admin diperlukan untuk menyimpan template WhatsApp."
      : "Template belum dapat disimpan. Silakan coba kembali." };
  }
}
