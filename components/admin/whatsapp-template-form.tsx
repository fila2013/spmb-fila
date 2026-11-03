"use client";

import { startTransition, useActionState, useId, useRef, useState } from "react";

import { saveWhatsappTemplateAction } from "@/app/admin/konten/kirim-wa/actions";
import { KategoriTemplateWhatsapp } from "@/generated/prisma/enums";
import { initialWhatsappTemplateActionState, type WhatsappTemplateActionState } from "@/lib/whatsapp/template-action-state";
import {
  WHATSAPP_TEMPLATE_BODY_MAX,
  WHATSAPP_TEMPLATE_TITLE_MAX,
  whatsappTemplateCategoryLabels,
  whatsappTemplateVariables,
  type WhatsappTemplateRecord,
} from "@/lib/whatsapp/templates";

const emptyTemplate: Omit<WhatsappTemplateRecord, "id"> = { judul: "", kategori: KategoriTemplateWhatsapp.INFORMASI_UMUM, isiPesan: "", statusAktif: true };
const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 disabled:opacity-70";

export function WhatsappTemplateForm({ template }: { template?: WhatsappTemplateRecord }) {
  const formId = useId();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(template ?? emptyTemplate);
  const [insertionError, setInsertionError] = useState<string>();
  const [state, action, pending] = useActionState(async (previous: WhatsappTemplateActionState, formData: FormData) => {
    const saved = await saveWhatsappTemplateAction(previous, formData);
    if (saved.status === "success" && saved.template) setDraft(template ? saved.template : emptyTemplate);
    return saved;
  }, initialWhatsappTemplateActionState);

  function insertVariable(token: string) {
    const input = textarea.current;
    const start = input?.selectionStart ?? draft.isiPesan.length;
    const end = input?.selectionEnd ?? draft.isiPesan.length;
    const next = `${draft.isiPesan.slice(0, start)}${token}${draft.isiPesan.slice(end)}`;
    if (next.length > WHATSAPP_TEMPLATE_BODY_MAX) {
      setInsertionError(`Isi pesan maksimal ${WHATSAPP_TEMPLATE_BODY_MAX} karakter.`);
      return;
    }
    setInsertionError(undefined);
    setDraft((current) => ({ ...current, isiPesan: next }));
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  const titleError = state.fieldErrors?.judul?.[0];
  const categoryError = state.fieldErrors?.kategori?.[0];
  const bodyError = insertionError ?? state.fieldErrors?.isiPesan?.[0];

  return (
    <form action={action} onSubmit={(event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      startTransition(() => action(data));
    }} className="grid gap-4">
      {template ? <input type="hidden" name="id" value={template.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
          Judul template
          <input className={inputClass} name="judul" required maxLength={WHATSAPP_TEMPLATE_TITLE_MAX} value={draft.judul} disabled={pending} onChange={(event) => setDraft({ ...draft, judul: event.target.value })} aria-invalid={Boolean(titleError)} aria-describedby={titleError ? `${formId}-title-error` : undefined} placeholder="Contoh: Pengingat Daftar Ulang" />
          {titleError ? <span id={`${formId}-title-error`} className="text-xs text-red-700">{titleError}</span> : null}
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
          Kategori template
          <select className={inputClass} name="kategori" value={draft.kategori} disabled={pending} onChange={(event) => {
            const kategori = Object.values(KategoriTemplateWhatsapp).find((value) => value === event.target.value);
            if (kategori) setDraft({ ...draft, kategori });
          }} aria-invalid={Boolean(categoryError)} aria-describedby={categoryError ? `${formId}-category-error` : undefined}>
            {Object.values(KategoriTemplateWhatsapp).map((value) => <option key={value} value={value}>{whatsappTemplateCategoryLabels[value]}</option>)}
          </select>
          {categoryError ? <span id={`${formId}-category-error`} className="text-xs text-red-700">{categoryError}</span> : null}
        </label>
      </div>

      <div className="min-w-0">
        <label htmlFor={`${formId}-body`} className="text-sm font-semibold text-slate-700">Isi template pesan</label>
        <div role="group" aria-label="Sisipkan variabel" className="mt-2 flex flex-wrap gap-2">
          {whatsappTemplateVariables.map(({ token, description }) => (
            <button key={token} type="button" disabled={pending} onClick={() => insertVariable(token)} title={description} className="rounded-lg border border-emerald-900/15 bg-emerald-50 px-2.5 py-1.5 font-mono text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-60">{token}</button>
          ))}
        </div>
        <textarea ref={textarea} id={`${formId}-body`} name="isiPesan" className={`${inputClass} mt-3 leading-6`} required maxLength={WHATSAPP_TEMPLATE_BODY_MAX} rows={6} value={draft.isiPesan} disabled={pending} onChange={(event) => {
          setInsertionError(undefined);
          setDraft({ ...draft, isiPesan: event.target.value });
        }} aria-invalid={Boolean(bodyError)} aria-describedby={`${formId}-body-help${bodyError ? ` ${formId}-body-error` : ""}`} placeholder="Halo {nama_wali}, berikut informasi untuk {nama_peserta}." />
        <p id={`${formId}-body-help`} className="mt-1 text-xs leading-5 text-slate-600">Klik variabel untuk menyisipkan di posisi kursor. {draft.isiPesan.length}/{WHATSAPP_TEMPLATE_BODY_MAX} karakter.</p>
        {bodyError ? <p id={`${formId}-body-error`} className="mt-1 text-xs text-red-700">{bodyError}</p> : null}
      </div>

      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input type="checkbox" name="statusAktif" className="size-4 accent-emerald-900" checked={draft.statusAktif} disabled={pending} onChange={(event) => setDraft({ ...draft, statusAktif: event.target.checked })} />
        Template aktif
      </label>
      {state.message ? <p role={state.status === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${state.status === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-red-200 bg-red-50 text-red-800"}`}>{state.message}</p> : null}
      <button type="submit" disabled={pending} className="justify-self-start rounded-xl bg-emerald-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60">{pending ? "Menyimpan…" : "Simpan template"}</button>
    </form>
  );
}
