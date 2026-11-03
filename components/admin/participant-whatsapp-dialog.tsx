"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ExternalLink, X } from "lucide-react";

import { loadParticipantWhatsappDrafts } from "@/app/admin/peserta/whatsapp-actions";
import { buildWhatsappDraft } from "@/lib/whatsapp/message";
import { whatsappTemplateCategoryLabels } from "@/lib/whatsapp/templates";

type DraftResult = Awaited<ReturnType<typeof loadParticipantWhatsappDrafts>>;

const selectClassName = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-900";

export function ParticipantWhatsappDialog({
  participantId,
  participantName,
  onClose,
}: {
  participantId: string;
  participantName: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [result, setResult] = useState<DraftResult | null>(null);
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");

  useEffect(() => {
    dialog.current?.showModal();
    closeButton.current?.focus();
  }, []);

  useEffect(() => {
    let current = true;
    void loadParticipantWhatsappDrafts(participantId).then((data) => {
      if (current) setResult(data);
    }).catch(() => {
      if (current) setResult({ ok: false, message: "Draf WhatsApp belum dapat dimuat. Tutup dialog, lalu coba lagi." });
    });
    return () => { current = false; };
  }, [participantId]);

  const data = result?.ok ? result : null;
  const contact = data?.contacts.find((item) => item.role === selectedRole) ?? data?.contacts[0];
  const template = data?.templates.find((item) => item.id === selectedTemplate) ?? data?.templates[0];
  const draft = data && contact && template
    ? buildWhatsappDraft(template.isiPesan, contact.number, { ...data.values, nama_wali: contact.name })
    : null;

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby={titleId}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl backdrop:bg-slate-950/60 sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id={titleId} className="text-xl font-bold text-emerald-950">Kirim WhatsApp</h2>
          <p className="mt-1 break-words text-sm text-slate-600">{data?.participantName ?? participantName}</p>
        </div>
        <button ref={closeButton} type="button" onClick={() => dialog.current?.close()} aria-label="Tutup draf WhatsApp" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100">
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>
      {!result ? <p role="status" className="mt-5 text-sm text-slate-600">Memuat kontak wali dan template aktif…</p> : null}
      {result && !result.ok ? <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">{result.message}</p> : null}
      {data ? (
        <div className="mt-5 grid gap-4">
          {contact ? (
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Penerima
              <select className={selectClassName} value={contact.role} onChange={(event) => setSelectedRole(event.target.value)}>
                {data.contacts.map((item) => (
                  <option key={item.role} value={item.role}>
                    {item.role === "ayah" ? "Ayah" : "Bunda"} · {item.name} · +{item.number}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
              Belum ada nomor WhatsApp wali yang valid pada Data Pribadi peserta.{" "}
              <Link href={`/admin/peserta/${participantId}`} className="font-bold underline">Lihat detail peserta</Link>
            </p>
          )}
          {template ? (
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Template pesan
              <select className={selectClassName} value={template.id} onChange={(event) => setSelectedTemplate(event.target.value)}>
                {data.templates.map((item) => (
                  <option key={item.id} value={item.id}>{whatsappTemplateCategoryLabels[item.kategori]} · {item.judul}</option>
                ))}
              </select>
            </label>
          ) : (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
              Belum ada template aktif.{" "}
              <Link href="/admin/konten/kirim-wa" className="font-bold underline">Kelola template WhatsApp</Link>
            </p>
          )}
          {draft?.url ? (
            <>
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Pratinjau pesan</h3>
                <p className="mt-1.5 max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-900">{draft.text}</p>
              </div>
              <p className="text-xs text-slate-600">Periksa penerima dan pesan. Pesan baru terkirim setelah Anda menekan Kirim di WhatsApp.</p>
              <a href={draft.url} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-900">
                Buka WhatsApp <ExternalLink aria-hidden="true" className="size-4" />
              </a>
            </>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
