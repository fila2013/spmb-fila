"use client";

import { useActionState, useRef, useState } from "react";

import { saveAnnouncementTemplatesAction } from "@/app/admin/(stages)/actions";
import { initialStageActionState, type StageActionState } from "@/lib/stages/action-state";
import { announcementVariables, type AnnouncementTemplates } from "@/lib/stages/announcement-letter";

function TemplateEditor({ name, label, value, onChange, error, disabled }: {
  name: keyof AnnouncementTemplates;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled: boolean;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  function insert(token: string) {
    const input = textarea.current;
    const start = input?.selectionStart ?? value.length;
    const end = input?.selectionEnd ?? value.length;
    onChange(`${value.slice(0, start)}${token}${value.slice(end)}`);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + token.length, start + token.length);
    });
  }
  return <div className="min-w-0">
    <label htmlFor={`template-${name}`} className="text-sm font-bold text-emerald-950">{label}</label>
    <div className="mt-2 flex flex-wrap gap-2" aria-label={`Sisipkan variabel pada ${label}`}>
      {announcementVariables.map(({ token, description }) => <button key={token} type="button" disabled={disabled} onClick={() => insert(token)} title={description} className="rounded-lg border border-emerald-900/15 bg-emerald-50 px-2.5 py-1.5 font-mono text-xs text-emerald-900 hover:bg-emerald-100 disabled:opacity-60">{token}</button>)}
    </div>
    <textarea ref={textarea} id={`template-${name}`} name={name} required maxLength={10000} rows={17} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `error-${name}` : undefined} className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-800 disabled:opacity-70" />
    {error ? <p id={`error-${name}`} className="mt-1 text-xs text-red-700">{error}</p> : null}
  </div>;
}

export function AnnouncementTemplateForm({ value }: { value: AnnouncementTemplates }) {
  const [templates, setTemplates] = useState(value);
  const [state, action, pending] = useActionState(async (previous: StageActionState, formData: FormData) => {
    const saved = await saveAnnouncementTemplatesAction(previous, formData);
    if (saved.status === "success" && saved.templates) setTemplates(saved.templates);
    return saved;
  }, initialStageActionState);

  return <form action={action} className="grid gap-5">
    <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-950">
      <p>Klik variabel untuk menyisipkannya ke posisi kursor. Nama, jalur, dan keputusan akan terisi otomatis pada surat setiap peserta setelah tanggal rilis.</p>
      <dl className="mt-2 grid gap-1 sm:grid-cols-3">{announcementVariables.map(({ token, description }) => <div key={token}><dt className="font-mono text-xs font-bold">{token}</dt><dd className="text-xs">{description}</dd></div>)}</dl>
    </div>
    <div className="grid gap-6 xl:grid-cols-2">
      <TemplateEditor name="diterima" label={'Template Surat "DITERIMA"'} value={templates.diterima} onChange={(diterima) => setTemplates((current) => ({ ...current, diterima }))} error={state.fieldErrors?.diterima?.[0]} disabled={pending} />
      <TemplateEditor name="tidakDiterima" label={'Template Surat "TIDAK DITERIMA"'} value={templates.tidakDiterima} onChange={(tidakDiterima) => setTemplates((current) => ({ ...current, tidakDiterima }))} error={state.fieldErrors?.tidakDiterima?.[0]} disabled={pending} />
    </div>
    {state.message ? <p role="status" className={`rounded-xl border px-4 py-3 text-sm ${state.status === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-red-200 bg-red-50 text-red-800"}`}>{state.message}</p> : null}
    <button type="submit" disabled={pending} className="justify-self-start rounded-xl bg-emerald-900 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60">{pending ? "Menyimpan…" : "Simpan Template Surat"}</button>
  </form>;
}
