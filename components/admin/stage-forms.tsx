"use client";

/* eslint-disable @next/next/no-img-element -- CMS URLs are runtime-configured Supabase Storage assets. */

import { useActionState, useEffect, useState } from "react";

import {
  createStageContentAction,
  deleteStageContentAction,
  quickUpdateAnnouncementAction,
  quickUpdateAssessmentAction,
  updateAnnouncementAction,
  updateAssessmentAction,
  updateStageContentAction,
} from "@/app/admin/(stages)/actions";
import { StatusAssessment, StatusPengumuman, TahapKonten } from "@/generated/prisma/enums";
import { initialStageActionState, type StageActionState } from "@/lib/stages/action-state";

function Notice({ state }: { state: StageActionState }) {
  if (!state.message) return null;
  return <p aria-live="polite" className={`rounded-xl border px-3 py-2 text-sm ${state.status === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800"}`}>{state.message}</p>;
}

type ContentValue = { id: string; judul: string; tanggal: string; isiTeks: string; gambarUrl: string; youtubeVideoId: string; urutanLayout: number; minParticipantOrder: number | null; maxParticipantOrder: number | null; statusAktif: boolean; jalurId: string; kategoriId: string };

export function StageContentForm({ tahap, value, jalur, kategori, globalOnly = false }: { tahap: TahapKonten; value?: ContentValue; jalur: Array<{ id: string; nama: string }>; kategori: Array<{ id: string; nama: string }>; globalOnly?: boolean }) {
  const [state, action, pending] = useActionState(value ? updateStageContentAction : createStageContentAction, initialStageActionState);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="tahap" value={tahap} />
      {value ? <><input type="hidden" name="id" value={value.id} /><input type="hidden" name="gambarUrl" value={value.gambarUrl} /></> : null}
      <label className="text-sm font-semibold text-slate-800">Judul<input name="judul" required maxLength={200} defaultValue={value?.judul} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" />{state.fieldErrors?.judul ? <span className="text-xs text-red-700">{state.fieldErrors.judul[0]}</span> : null}</label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-800">Tanggal/periode<input name="tanggal" type="date" defaultValue={value?.tanggal} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" /></label>
        <label className="text-sm font-semibold text-slate-800">Urutan blok<input name="urutanLayout" type="number" min={0} required defaultValue={value?.urutanLayout ?? 0} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" /></label>
      </div>
      {!globalOnly ? <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-800">Minimal Urutan Peserta<input name="minParticipantOrder" type="number" min={1} max={2147483647} step={1} defaultValue={value?.minParticipantOrder ?? ""} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" />{state.fieldErrors?.minParticipantOrder ? <span className="text-xs text-red-700">{state.fieldErrors.minParticipantOrder[0]}</span> : null}</label>
        <label className="text-sm font-semibold text-slate-800">Maksimal Urutan Peserta<input name="maxParticipantOrder" type="number" min={1} max={2147483647} step={1} defaultValue={value?.maxParticipantOrder ?? ""} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" />{state.fieldErrors?.maxParticipantOrder ? <span className="text-xs text-red-700">{state.fieldErrors.maxParticipantOrder[0]}</span> : null}</label>
        <p className="text-xs font-normal leading-5 text-slate-500 sm:col-span-2">{tahap === TahapKonten.ASSESSMENT || tahap === TahapKonten.ANNOUNCEMENT
          ? `Nomor peserta dihitung per jalur lintas kategori berdasarkan waktu pendaftaran: hanya peserta ${tahap === TahapKonten.ASSESSMENT ? "Menunggu Asesmen" : "yang sudah mencapai Menunggu Pengumuman"}. Filter kategori menentukan siapa yang melihat blok, bukan kelompok hitung urutannya.`
          : "Nomor peserta dihitung per jalur dan kategori berdasarkan waktu pendaftaran."} Kosong berarti tanpa batas pada sisi tersebut; berbeda dari urutan tampil blok.</p>
      </div> : null}
      <label className="text-sm font-semibold text-slate-800">Isi informasi<textarea name="isiTeks" maxLength={10000} rows={5} defaultValue={value?.isiTeks} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" /></label>
      <label className="text-sm font-semibold text-slate-800">Gambar (JPG, PNG, WebP; maks. 5 MB)<input name="gambar" type="file" accept="image/jpeg,image/png,image/webp" className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal" /></label>
      {value?.gambarUrl ? <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"><img src={value.gambarUrl} alt={`Pratinjau ${value.judul}`} className="max-h-56 w-full object-cover" /><p className="px-3 py-2 text-xs text-slate-500">Gambar saat ini tetap digunakan bila tidak memilih file baru.</p></div> : null}
      {globalOnly ? <label className="text-sm font-semibold text-slate-800">Link YouTube (opsional)<input name="youtubeVideoId" type="url" inputMode="url" placeholder="https://www.youtube.com/watch?v=…" defaultValue={value?.youtubeVideoId ? `https://youtu.be/${value.youtubeVideoId}` : ""} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" /><span className="mt-1 block text-xs font-normal leading-5 text-slate-500">Video ditampilkan di bawah judul dan diputar otomatis tanpa suara agar diizinkan browser.</span></label> : <input type="hidden" name="youtubeVideoId" value="" />}
      {globalOnly ? <><input type="hidden" name="jalurId" value="" /><input type="hidden" name="kategoriId" value="" /></> : <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-800">Khusus jalur<select name="jalurId" defaultValue={value?.jalurId ?? ""} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal"><option value="">Semua jalur</option>{jalur.map((item) => <option key={item.id} value={item.id}>{item.nama}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-800">Khusus kategori<select name="kategoriId" defaultValue={value?.kategoriId ?? ""} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal"><option value="">Semua kategori</option>{kategori.map((item) => <option key={item.id} value={item.id}>{item.nama}</option>)}</select></label>
      </div>}
      <label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-800"><input type="checkbox" name="statusAktif" defaultChecked={value?.statusAktif ?? true} /> Konten aktif</label>
      <Notice state={state} />
      <button disabled={pending} className="rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{pending ? "Menyimpan…" : value ? "Simpan perubahan" : "Tambah konten"}</button>
    </form>
  );
}

export function DeleteStageContentForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(deleteStageContentAction, initialStageActionState);
  return <form action={action} className="mt-4 grid gap-3 rounded-xl border border-red-200 bg-red-50 p-3"><input type="hidden" name="id" value={id} /><label className="flex items-start gap-2 text-xs leading-5 text-red-950"><input type="checkbox" name="confirmation" value="HAPUS" required className="mt-1" /> Saya memahami blok informasi dan file gambarnya akan dihapus.</label><Notice state={state} /><button type="submit" disabled={pending} className="rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-bold text-red-800 hover:bg-red-100 disabled:opacity-60">{pending ? "Menghapus…" : "Hapus konten"}</button></form>;
}

export function AssessmentResultForm({ id, status, catatan, quickEdit = false, onSaved }: { id: string; status: StatusAssessment; catatan: string; quickEdit?: boolean; onSaved?: (state: StageActionState) => void }) {
  const [state, action, pending] = useActionState(quickEdit ? quickUpdateAssessmentAction : updateAssessmentAction, initialStageActionState);
  useEffect(() => {
    if (state.status === "success") onSaved?.(state);
  }, [state, onSaved]);
  return <form action={action} className="grid gap-4"><input type="hidden" name="id" value={id} /><label className="text-sm font-semibold">Status<select name="status" defaultValue={status} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal"><option value={StatusAssessment.BELUM}>Belum dinilai</option><option value={StatusAssessment.HADIR}>Hadir</option><option value={StatusAssessment.TIDAK_HADIR}>Tidak hadir</option></select></label><label className="text-sm font-semibold">Catatan internal<textarea name="catatan" rows={4} maxLength={5000} defaultValue={catatan} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" /></label><Notice state={state} /><button disabled={pending} className="rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{pending ? "Menyimpan…" : "Simpan assessment"}</button></form>;
}

export function AnnouncementResultForm({ id, statusAkhir, tanggalRilis, childName, requiresDeleteConfirmation, finalRouteChoiceEnabled = false, quickEdit = false, onSaved }: { id: string; statusAkhir: StatusPengumuman | null; tanggalRilis: string; childName: string; requiresDeleteConfirmation: boolean; finalRouteChoiceEnabled?: boolean; quickEdit?: boolean; onSaved?: (state: StageActionState) => void }) {
  const [state, action, pending] = useActionState(quickEdit ? quickUpdateAnnouncementAction : updateAnnouncementAction, initialStageActionState);
  const [decision, setDecision] = useState<StatusPengumuman | "">(statusAkhir ?? "");
  useEffect(() => {
    if (state.status === "success") onSaved?.(state);
  }, [state, onSaved]);
  const rejected = decision === StatusPengumuman.TIDAK_DITERIMA;
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="id" value={id} />
      <label className="text-sm font-semibold">
        Keputusan
        <select name="statusAkhir" required value={decision} onChange={(event) => setDecision(event.target.value as StatusPengumuman | "")} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal">
          <option value="" disabled>Pilih keputusan</option>
          <option value={StatusPengumuman.DITERIMA}>Diterima</option>
          <option value={StatusPengumuman.TIDAK_DITERIMA}>Tidak diterima</option>
        </select>
      </label>
      <label className="text-sm font-semibold">
        Tanggal rilis
        <input name="tanggalRilis" type="date" required defaultValue={tanggalRilis} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" />
      </label>
      {rejected ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-950">
        <label className="flex items-start gap-2 font-semibold">
          <input type="checkbox" required className="mt-1" />
          Saya yakin keputusan “Tidak diterima” untuk {childName} sudah benar.
        </label>
        {requiresDeleteConfirmation ? <label className="mt-3 block font-semibold">
          Konfirmasi penghapusan jika hasil dirilis
          <span className="mt-1 block text-xs font-normal leading-5">Data pribadi anak akan dihapus permanen setelah keputusan ini dirilis. Akun, anak lain, dan jejak pembayaran tetap disimpan. Ketik <strong>HAPUS {childName}</strong>.</span>
          <input name="deletionConfirmation" required autoComplete="off" placeholder={`HAPUS ${childName}`} className="mt-2 w-full rounded-lg border border-red-300 bg-white px-3 py-2 font-normal text-slate-950" />
        </label> : null}
      </div> : null}
      {!rejected || !requiresDeleteConfirmation ? <input type="hidden" name="deletionConfirmation" value="" /> : null}
      <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">Hasil tidak terlihat oleh wali sebelum tanggal rilis. Jika jalur fallback penuh, peserta otomatis masuk antrian FIFO.{finalRouteChoiceEnabled ? " Peserta yang diterima wajib menentukan pilihan kelas final yang dikonfigurasi terpisah sebelum dapat melanjutkan daftar ulang." : ""}</p>
      <Notice state={state} />
      <button disabled={pending} className={`rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-60 ${rejected && requiresDeleteConfirmation ? "bg-red-800 hover:bg-red-700" : "bg-emerald-900 hover:bg-emerald-800"}`}>{pending ? "Menyimpan…" : "Simpan pengumuman"}</button>
    </form>
  );
}
