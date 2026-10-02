"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import {
  AnnouncementResultForm,
  AssessmentResultForm,
} from "@/components/admin/stage-forms";
import { StatusKeseluruhan } from "@/generated/prisma/enums";
import {
  formatParticipantRegistrationDate,
  statusPresentation,
} from "@/lib/calon-murid/presentation";
import type { StageActionState } from "@/lib/stages/action-state";
import {
  applyQuickEditResult,
  type QuickEditParticipant,
} from "@/lib/stages/quick-edit";

export function ParticipantQuickEditTable({
  initialParticipants,
  filteredStatus,
}: {
  initialParticipants: QuickEditParticipant[];
  filteredStatus: StatusKeseluruhan | null;
}) {
  const router = useRouter();
  const [participants, setParticipants] = useState(initialParticipants);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const selected = participants.find((item) => item.id === selectedId) ?? null;

  const closeModal = useCallback(() => setSelectedId(null), []);
  const handleSaved = useCallback((state: StageActionState) => {
    const result = state.quickEdit;
    if (!selectedId || !result) return;
    setParticipants((current) => applyQuickEditResult(current, selectedId, result, filteredStatus));
    setSuccessMessage(state.message ?? "Perubahan peserta berhasil disimpan.");
    closeModal();
    router.refresh();
  }, [selectedId, filteredStatus, closeModal, router]);

  useEffect(() => {
    if (!selected) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeModal();
      if (event.key !== "Tab") return;
      const focusable = dialog.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [selected, closeModal]);

  return <>
    {successMessage ? <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">{successMessage}</p> : null}
    <div>
      <h2 className="text-xl font-bold text-emerald-950">Daftar peserta</h2>
      <p className="mt-1 text-sm text-slate-600">{participants.length} peserta sesuai filter.</p>
    </div>
    <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-emerald-950 text-white"><tr><th className="px-4 py-3">Peserta</th><th className="px-4 py-3">Jalur / kategori</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Aksi</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {participants.map((item) => {
            const status = statusPresentation[item.statusKeseluruhan];
            return <tr key={item.id}>
              <td className="px-4 py-3"><p className="font-semibold text-slate-900">{item.namaAnak}</p><p className="text-xs text-slate-500">{item.email}</p><time dateTime={item.createdAt} className="mt-1 block text-xs text-slate-500">Tgl daftar: {formatParticipantRegistrationDate(new Date(item.createdAt))}</time></td>
              <td className="px-4 py-3 text-slate-700">{item.jalurKategori}</td>
              <td className="px-4 py-3"><button type="button" onClick={() => setSelectedId(item.id)} aria-label={`Edit cepat assessment dan pengumuman ${item.namaAnak}`} className={`cursor-pointer rounded-full px-2.5 py-1 text-xs font-bold transition hover:brightness-90 hover:ring-2 hover:ring-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 ${status.className}`}>{status.label}</button></td>
              <td className="px-4 py-3"><Link href={`/admin/peserta/${item.id}`} className="font-bold text-emerald-800 hover:underline">Kelola</Link></td>
            </tr>;
          })}
        </tbody>
      </table>
      {participants.length === 0 ? <p className="p-6 text-center text-sm text-slate-600">Tidak ada peserta yang cocok dengan filter.</p> : null}
    </div>
    {selected ? <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="quick-edit-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div><h2 id="quick-edit-title" className="text-xl font-bold text-emerald-950">Edit cepat · {selected.namaAnak}</h2><p className="mt-1 text-sm text-slate-600">{selected.jalurKategori} · {statusPresentation[selected.statusKeseluruhan].label}</p></div>
          <button ref={closeButton} type="button" onClick={closeModal} aria-label="Tutup modal" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><X className="size-5" /></button>
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section><h3 className="mb-3 text-lg font-bold text-emerald-950">Hasil assessment</h3>
            {selected.statusKeseluruhan === StatusKeseluruhan.MENUNGGU_ASESMEN || selected.statusKeseluruhan === StatusKeseluruhan.MENUNGGU_PENGUMUMAN
              ? <AssessmentResultForm id={selected.id} status={selected.assessmentStatus} catatan={selected.assessmentNote} quickEdit onSaved={handleSaved} />
              : <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">Assessment hanya dapat diubah pada tahap menunggu asesmen atau pengumuman.</p>}
          </section>
          <section><h3 className="mb-3 text-lg font-bold text-emerald-950">Pengumuman</h3>
            {selected.announcementLocked
              ? <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">Hasil sudah dirilis dan dikunci oleh pilihan jalur final atau antrean kuota.</p>
              : <AnnouncementResultForm id={selected.id} statusAkhir={selected.announcementStatus} tanggalRilis={selected.releaseDate} childName={selected.namaAnak} requiresDeleteConfirmation={selected.requiresDeleteConfirmation} finalRouteChoiceEnabled={selected.finalRouteChoiceEnabled} quickEdit onSaved={handleSaved} />}
          </section>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-4"><Link href={`/admin/peserta/${selected.id}`} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Buka halaman detail</Link><button type="button" onClick={closeModal} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-200">Batal / Tutup</button></div>
      </div>
    </div> : null}
  </>;
}
