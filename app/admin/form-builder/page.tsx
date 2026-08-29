import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import {
  DeleteFormFieldForm,
  FormFieldForm,
} from "@/components/admin/form-builder-forms";
import { FormType, UserRole } from "@/generated/prisma/enums";
import { requireRolePage } from "@/lib/auth/navigation";
import { listFormFields } from "@/lib/enrollment/service";

export const metadata: Metadata = { title: "Form builder enrollment" };

const sectionNames = {
  [FormType.DATA_PRIBADI]: "Data Pribadi",
  [FormType.OBSERVASI]: "Observasi",
};

export default async function FormBuilderPage() {
  const admin = await requireRolePage(UserRole.ADMIN);
  const fields = await listFormFields();

  return (
    <AdminShell
      activePath="/admin/form-builder"
      title="Form builder enrollment"
      description="Atur field Data Pribadi dan pertanyaan Observasi. Perubahan berlaku untuk seluruh pendaftar yang belum submit final."
      email={admin.email}
    >
      <section className="rounded-2xl border border-emerald-950/10 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-bold text-emerald-950">Tambah field</h2>
        <p className="mt-1 text-sm text-slate-600">Auto-fill email hanya untuk tipe Email; asal TK hanya untuk tipe Teks.</p>
        <div className="mt-5 max-w-3xl"><FormFieldForm /></div>
      </section>

      {Object.values(FormType).map((formType) => {
        const formFields = fields.filter((field) => field.formType === formType);
        return (
          <section key={formType} className="mt-7">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700">Bagian formulir</p>
                <h2 className="mt-1 text-2xl font-bold text-emerald-950">{sectionNames[formType]}</h2>
              </div>
              <span className="text-sm text-slate-500">{formFields.length} field</span>
            </div>
            <div className="mt-4 grid gap-4">
              {formFields.map((field) => (
                <article key={field.id} className="rounded-2xl border border-emerald-950/10 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-500">Urutan {field.urutan} · {inputLabelsForPage[field.tipeInput]}</p>
                      <h3 className="mt-1 font-bold text-emerald-950">{field.label}</h3>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{field.wajib ? "Wajib" : "Opsional"}</span>
                  </div>
                  <details className="mt-4 border-t border-emerald-950/10 pt-4">
                    <summary className="cursor-pointer text-sm font-bold text-emerald-800">Edit field</summary>
                    <div className="mt-5 max-w-3xl"><FormFieldForm value={field} /></div>
                    <DeleteFormFieldForm id={field.id} />
                  </details>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </AdminShell>
  );
}

const inputLabelsForPage = {
  TEXT: "Teks singkat",
  TEXTAREA: "Teks panjang",
  DATE: "Tanggal",
  NUMBER: "Angka",
  EMAIL: "Email",
  TEL: "Telepon",
} as const;
