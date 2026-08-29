"use client";

import { useActionState } from "react";

import {
  createJalurAction,
  createKategoriAction,
  saveBiayaAction,
  updateJalurAction,
  updateKategoriAction,
} from "@/app/admin/(master-data)/actions";
import { KategoriTipe } from "@/generated/prisma/enums";
import { initialMasterDataActionState } from "@/lib/master-data/action-state";

type JalurValue = {
  id: string;
  nama: string;
  statusAktif: boolean;
  periodeMulai: string;
  periodeSelesai: string;
  kuotaMaks: number | null;
  kuotaTerpakai: number;
  fallbackJalurId: string | null;
  hapusDataJikaGagal: boolean;
};

type KategoriValue = {
  id: string;
  nama: string;
  tipe: string;
  statusAktif: boolean;
  periodeMulai: string;
  periodeSelesai: string;
  kuotaMaks: number | null;
  kuotaTerpakai: number;
};

function Notice({ state }: { state: typeof initialMasterDataActionState }) {
  if (!state.message) return null;
  return (
    <p
      aria-live="polite"
      className={`rounded-xl border px-3 py-2 text-sm ${
        state.status === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-red-200 bg-red-50 text-red-800"
      }`}
    >
      {state.message}
    </p>
  );
}

function Input({
  label,
  name,
  type = "text",
  defaultValue,
  min,
  required,
  error,
}: {
  label: string;
  name: string;
  type?: "text" | "date" | "number";
  defaultValue?: string | number;
  min?: number;
  required?: boolean;
  error?: string[];
}) {
  return (
    <label className="block text-sm font-semibold text-slate-800">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        min={min}
        required={required}
        aria-invalid={Boolean(error)}
        className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-950 outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10"
      />
      {error ? <span className="mt-1 block text-xs text-red-700">{error[0]}</span> : null}
    </label>
  );
}

export function JalurForm({
  value,
  choices,
}: {
  value?: JalurValue;
  choices: Array<{ id: string; nama: string }>;
}) {
  const action = value ? updateJalurAction : createJalurAction;
  const [state, formAction, pending] = useActionState(
    action,
    initialMasterDataActionState,
  );

  return (
    <form action={formAction} className="grid gap-4">
      {value ? <input type="hidden" name="id" value={value.id} /> : null}
      <Input label="Nama jalur" name="nama" required defaultValue={value?.nama} error={state.fieldErrors?.nama} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Periode mulai" name="periodeMulai" type="date" defaultValue={value?.periodeMulai} error={state.fieldErrors?.periodeMulai} />
        <Input label="Periode selesai" name="periodeSelesai" type="date" defaultValue={value?.periodeSelesai} error={state.fieldErrors?.periodeSelesai} />
      </div>
      <Input label={`Kuota maksimum${value ? ` (terpakai ${value.kuotaTerpakai})` : ""}`} name="kuotaMaks" type="number" min={0} defaultValue={value?.kuotaMaks ?? undefined} error={state.fieldErrors?.kuotaMaks} />
      <label className="block text-sm font-semibold text-slate-800">
        Jalur fallback jika gagal
        <select name="fallbackJalurId" defaultValue={value?.fallbackJalurId ?? ""} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal">
          <option value="">Tidak ada fallback</option>
          {choices.filter((choice) => choice.id !== value?.id).map((choice) => <option key={choice.id} value={choice.id}>{choice.nama}</option>)}
        </select>
      </label>
      <div className="grid gap-3 rounded-xl bg-slate-50 p-3 text-sm">
        <label className="flex items-center gap-2 font-semibold text-slate-800"><input type="checkbox" name="statusAktif" defaultChecked={value?.statusAktif ?? true} /> Aktifkan jalur</label>
        <label className="flex items-start gap-2 font-semibold text-slate-800"><input className="mt-1" type="checkbox" name="hapusDataJikaGagal" defaultChecked={value?.hapusDataJikaGagal ?? false} /> Hapus data calon murid jika gagal</label>
        <p className="text-xs leading-5 text-slate-500">Auto-delete tidak dapat diaktifkan bersama jalur fallback. Eksekusinya tetap memerlukan konfirmasi admin pada Phase 8.</p>
      </div>
      <Notice state={state} />
      <button disabled={pending} className="rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60">{pending ? "Menyimpan…" : value ? "Simpan perubahan" : "Tambah jalur"}</button>
    </form>
  );
}

export function KategoriForm({ value }: { value?: KategoriValue }) {
  const action = value ? updateKategoriAction : createKategoriAction;
  const [state, formAction, pending] = useActionState(action, initialMasterDataActionState);
  return (
    <form action={formAction} className="grid gap-4">
      {value ? <input type="hidden" name="id" value={value.id} /> : null}
      <Input label="Nama kategori" name="nama" required defaultValue={value?.nama} error={state.fieldErrors?.nama} />
      <label className="block text-sm font-semibold text-slate-800">Tipe kategori
        <select name="tipe" defaultValue={value?.tipe ?? KategoriTipe.EKSTERNAL} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal">
          <option value={KategoriTipe.ALUMNI_TKFI}>Alumni TKIT</option>
          <option value={KategoriTipe.EKSTERNAL}>Eksternal / Umum</option>
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Periode mulai" name="periodeMulai" type="date" defaultValue={value?.periodeMulai} error={state.fieldErrors?.periodeMulai} />
        <Input label="Periode selesai" name="periodeSelesai" type="date" defaultValue={value?.periodeSelesai} error={state.fieldErrors?.periodeSelesai} />
      </div>
      <Input label={`Kuota maksimum${value ? ` (terpakai ${value.kuotaTerpakai})` : ""}`} name="kuotaMaks" type="number" min={0} defaultValue={value?.kuotaMaks ?? undefined} error={state.fieldErrors?.kuotaMaks} />
      <label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-800"><input type="checkbox" name="statusAktif" defaultChecked={value?.statusAktif ?? true} /> Aktifkan kategori</label>
      <Notice state={state} />
      <button disabled={pending} className="rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60">{pending ? "Menyimpan…" : value ? "Simpan perubahan" : "Tambah kategori"}</button>
    </form>
  );
}

export function BiayaForm({
  id,
  jalurId,
  kategoriId,
  nominal,
  statusAktif,
}: {
  id?: string;
  jalurId: string;
  kategoriId: string;
  nominal?: number;
  statusAktif?: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveBiayaAction, initialMasterDataActionState);
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-[minmax(150px,1fr)_auto] sm:items-end">
      <input type="hidden" name="id" value={id ?? ""} />
      <input type="hidden" name="jalurId" value={jalurId} />
      <input type="hidden" name="kategoriId" value={kategoriId} />
      <Input label="Nominal (Rupiah)" name="nominal" type="number" min={1} required defaultValue={nominal} error={state.fieldErrors?.nominal} />
      <label className="flex h-11 items-center gap-2 rounded-xl bg-slate-50 px-3 text-sm font-semibold text-slate-800"><input type="checkbox" name="statusAktif" defaultChecked={statusAktif ?? true} /> Aktif</label>
      <div className="sm:col-span-2"><Notice state={state} /></div>
      <button disabled={pending} className="rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60 sm:col-span-2">{pending ? "Menyimpan…" : id ? "Perbarui biaya" : "Atur nominal"}</button>
    </form>
  );
}

