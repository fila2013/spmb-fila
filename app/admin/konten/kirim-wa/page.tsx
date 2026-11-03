import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import { WhatsappTemplateForm } from "@/components/admin/whatsapp-template-form";
import { UserRole } from "@/generated/prisma/enums";
import { requireRolePage } from "@/lib/auth/navigation";
import { listWhatsappTemplates } from "@/lib/whatsapp/template-service";
import { whatsappTemplateCategoryLabels } from "@/lib/whatsapp/templates";

export const metadata: Metadata = { title: "Konten Kirim WhatsApp" };

export default async function WhatsappTemplatesPage() {
  const admin = await requireRolePage(UserRole.ADMIN);
  const templates = await listWhatsappTemplates();

  return (
    <AdminShell activePath="/admin/konten/kirim-wa" title="Konten Kirim WhatsApp" description="Kelola template untuk draf WhatsApp dari daftar peserta. Hanya template aktif yang bisa dipilih; pesan dikirim manual melalui WhatsApp." email={admin.email}>
      <section className="rounded-2xl border border-emerald-950/10 bg-white p-5 sm:p-6" aria-labelledby="new-template-title">
        <h2 id="new-template-title" className="mb-4 text-lg font-bold text-emerald-950">Tambah template</h2>
        <WhatsappTemplateForm />
      </section>
      <section className="mt-6 grid gap-3" aria-labelledby="saved-templates-title">
        <h2 id="saved-templates-title" className="text-lg font-bold text-emerald-950">Template tersimpan</h2>
        {templates.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">Belum ada template. Tambahkan satu template agar tersedia di daftar peserta.</p> : null}
        {templates.map((template) => (
          <details key={template.id} className="min-w-0 rounded-2xl border border-emerald-950/10 bg-white p-5">
            <summary className="cursor-pointer break-words text-sm font-bold text-emerald-950">
              {template.judul} <span className="ml-2 text-xs font-normal text-slate-600">{whatsappTemplateCategoryLabels[template.kategori]} · {template.statusAktif ? "Aktif" : "Nonaktif"}</span>
            </summary>
            <div className="mt-5"><WhatsappTemplateForm template={template} /></div>
          </details>
        ))}
      </section>
    </AdminShell>
  );
}
