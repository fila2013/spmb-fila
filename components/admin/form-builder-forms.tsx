"use client";

import { useActionState, useState } from "react";

import {
  createFormFieldAction,
  deleteFormFieldAction,
  updateFormFieldAction,
  updateRegistrationAgeRuleAction,
} from "@/app/admin/(enrollment)/actions";
import type { FormField } from "@/generated/prisma/client";
import { FormType, TipeInput } from "@/generated/prisma/enums";
import { initialEnrollmentActionState } from "@/lib/enrollment/action-state";
import { indonesianMonthNames } from "@/lib/enrollment/rules";

function Notice({
  state,
}: {
  state: typeof initialEnrollmentActionState;
}) {
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

const inputLabels: Record<TipeInput, string> = {
  [TipeInput.TEXT]: "Teks singkat",
  [TipeInput.TEXTAREA]: "Teks panjang",
  [TipeInput.DATE]: "Tanggal",
  [TipeInput.NUMBER]: "Angka",
  [TipeInput.EMAIL]: "Email",
  [TipeInput.TEL]: "Telepon",
  [TipeInput.OPTION]: "Pilihan Tunggal (dropdown)",
};

export function RegistrationAgeRulePanel({ value }: { value: FormField | null }) {
  const [state, formAction, pending] = useActionState(
    updateRegistrationAgeRuleAction,
    initialEnrollmentActionState,
  );
  const configuredRule = value && value.minAgeYears != null && value.ageReferenceMonth != null && value.ageReferenceYear != null
    ? { years: value.minAgeYears, month: value.ageReferenceMonth, year: value.ageReferenceYear,
        cutoffYear: value.ageReferenceYear - value.minAgeYears }
    : null;
  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 sm:p-6">
      <h2 className="text-lg font-bold text-emerald-950">Aturan usia sebelum pembayaran</h2>
      <p className="mt-1 text-sm leading-6 text-slate-700">
        Atur batas usia untuk Tanggal Lahir calon murid. Nilai ini dibaca langsung dari Form Builder saat pendaftaran, pemilihan kategori, dan pembayaran.
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-600">
        Perubahan berlaku untuk pendaftar baru dan peserta yang belum membayar; pembayaran yang sudah terverifikasi tidak dibatalkan otomatis.
      </p>
      {!value ? (
        <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          Field Tanggal lahir dengan auto-fill dari pendaftaran belum tersedia. Periksa field Data Pribadi di bawah sebelum mengatur usia.
        </p>
      ) : (
        <form key={value.updatedAt.toISOString()} action={formAction} className="mt-5 grid gap-4">
          <input type="hidden" name="fieldId" value={value.id} />
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm font-semibold text-slate-800">Usia Minimal (Tahun)
              <input name="minAgeYears" type="number" min={1} max={30} required defaultValue={value.minAgeYears ?? ""} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal" />
              {state.fieldErrors?.minAgeYears ? <span className="mt-1 block text-xs text-red-700">{state.fieldErrors.minAgeYears[0]}</span> : null}
            </label>
            <label className="text-sm font-semibold text-slate-800">Bulan Acuan Pendaftaran
              <select name="ageReferenceMonth" required defaultValue={value.ageReferenceMonth ?? ""} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal">
                <option value="" disabled>Pilih bulan</option>
                {indonesianMonthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
              </select>
              {state.fieldErrors?.ageReferenceMonth ? <span className="mt-1 block text-xs text-red-700">{state.fieldErrors.ageReferenceMonth[0]}</span> : null}
            </label>
            <label className="text-sm font-semibold text-slate-800">Tahun Acuan Pendaftaran
              <input name="ageReferenceYear" type="number" min={2000} max={2200} required defaultValue={value.ageReferenceYear ?? ""} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal" />
              {state.fieldErrors?.ageReferenceYear ? <span className="mt-1 block text-xs text-red-700">{state.fieldErrors.ageReferenceYear[0]}</span> : null}
            </label>
          </div>
          {configuredRule ? (
            <p className="rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-950">
              Aturan aktif: minimal {configuredRule.years} tahun per {indonesianMonthNames[configuredRule.month - 1]} {configuredRule.year}. Kelahiran sampai {indonesianMonthNames[configuredRule.month - 1]} {configuredRule.cutoffYear} memenuhi batas; mulai bulan berikutnya belum memenuhi.
            </p>
          ) : null}
          <Notice state={state} />
          <button disabled={pending} className="w-fit rounded-xl bg-emerald-900 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60">
            {pending ? "Menyimpan…" : "Simpan aturan usia"}
          </button>
        </form>
      )}
    </section>
  );
}

export function FormFieldForm({ value }: { value?: FormField }) {
  const [inputKind, setInputKind] = useState<TipeInput>(value?.tipeInput ?? TipeInput.TEXT);
  const [ageEnabled, setAgeEnabled] = useState(Boolean(value?.minAgeYears));
  const action = value ? updateFormFieldAction : createFormFieldAction;
  const [state, formAction, pending] = useActionState(
    action,
    initialEnrollmentActionState,
  );
  return (
    <form action={formAction} className="grid gap-4">
      {value ? <input type="hidden" name="id" value={value.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-800">
          Bagian formulir
          <select
            name="formType"
            defaultValue={value?.formType ?? FormType.DATA_PRIBADI}
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal"
          >
            <option value={FormType.DATA_PRIBADI}>Data Pribadi</option>
            <option value={FormType.OBSERVASI}>Observasi</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-800">
          Tipe input
          <select
            name="tipeInput"
            value={inputKind}
            onChange={(event) => setInputKind(event.target.value as TipeInput)}
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal"
          >
            {Object.values(TipeInput).map((type) => (
              <option key={type} value={type}>{inputLabels[type]}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="text-sm font-semibold text-slate-800">
        Label / pertanyaan
        <textarea
          name="label"
          required
          maxLength={150}
          defaultValue={value?.label}
          className="mt-1.5 min-h-20 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal"
        />
        {state.fieldErrors?.label ? (
          <span className="mt-1 block text-xs text-red-700">{state.fieldErrors.label[0]}</span>
        ) : null}
      </label>
      {inputKind === TipeInput.OPTION ? <label className="text-sm font-semibold text-slate-800">
        Daftar opsi pilihan
        <textarea
          name="options"
          required
          defaultValue={value?.options.join("\n") ?? ""}
          placeholder={"Laki-Laki\nPerempuan"}
          rows={4}
          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal"
        />
        <span className="mt-1 block text-xs font-normal text-slate-600">Pisahkan dengan baris baru atau koma. Minimal 2 opsi, maksimal 20.</span>
        {state.fieldErrors?.options ? <span className="mt-1 block text-xs text-red-700">{state.fieldErrors.options[0]}</span> : null}
      </label> : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-semibold text-slate-800">
          Urutan
          <input
            name="urutan"
            type="number"
            min={0}
            max={10_000}
            required
            defaultValue={value?.urutan ?? 0}
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal"
          />
        </label>
        {inputKind === TipeInput.TEL ? <label className="text-sm font-semibold text-slate-800">
          Validasi nomor
          <select name="validasi" defaultValue={value?.validasi ?? ""} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal">
            <option value="">Tidak ada</option>
            <option value="format_wa_indonesia">Nomor WA Indonesia</option>
          </select>
        </label> : <input type="hidden" name="validasi" value="" />}
        <label className="text-sm font-semibold text-slate-800">
          Auto-fill
          <select
            name="autoFillSource"
            defaultValue={value?.autoFillSource ?? ""}
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal"
          >
            <option value="">Tidak ada</option>
            <option value="akun_email">Email akun</option>
            <option value="kategori_asal_tk">Asal TK dari kategori</option>
            <option value="nama_anak">Nama lengkap anak dari pendaftaran</option>
            <option value="tempat_lahir">Tempat lahir dari pendaftaran</option>
            <option value="tanggal_lahir">Tanggal lahir dari pendaftaran</option>
          </select>
        </label>
      </div>
      {inputKind === TipeInput.DATE ? <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
          <input type="checkbox" checked={ageEnabled} onChange={(event) => setAgeEnabled(event.target.checked)} />
          Aktifkan validasi batas usia minimal
        </label>
        {ageEnabled ? <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="text-sm font-semibold text-slate-800">Usia Minimal (Tahun)
            <input name="minAgeYears" type="number" min={1} max={30} required defaultValue={value?.minAgeYears ?? 6} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal" />
            {state.fieldErrors?.minAgeYears ? <span className="mt-1 block text-xs text-red-700">{state.fieldErrors.minAgeYears[0]}</span> : null}
          </label>
          <label className="text-sm font-semibold text-slate-800">Bulan Acuan Pendaftaran
            <select name="ageReferenceMonth" required defaultValue={value?.ageReferenceMonth ?? 7} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal">
              {indonesianMonthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
            </select>
            {state.fieldErrors?.ageReferenceMonth ? <span className="mt-1 block text-xs text-red-700">{state.fieldErrors.ageReferenceMonth[0]}</span> : null}
          </label>
          <label className="text-sm font-semibold text-slate-800">Tahun Acuan Pendaftaran
            <input name="ageReferenceYear" type="number" min={2000} max={2200} required defaultValue={value?.ageReferenceYear ?? 2027} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal" />
            {state.fieldErrors?.ageReferenceYear ? <span className="mt-1 block text-xs text-red-700">{state.fieldErrors.ageReferenceYear[0]}</span> : null}
          </label>
        </div> : <><input type="hidden" name="minAgeYears" value="" /><input type="hidden" name="ageReferenceMonth" value="" /><input type="hidden" name="ageReferenceYear" value="" /></>}
        <p className="mt-3 text-xs leading-5 text-slate-600">Perhitungan memakai bulan dan tahun lahir. Lahir pada bulan acuan tetap memenuhi batas; bulan setelahnya belum.</p>
      </div> : <><input type="hidden" name="minAgeYears" value="" /><input type="hidden" name="ageReferenceMonth" value="" /><input type="hidden" name="ageReferenceYear" value="" /></>}
      <label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-800">
        <input type="checkbox" name="wajib" defaultChecked={value?.wajib ?? true} />
        Wajib diisi saat submit final
      </label>
      <Notice state={state} />
      <button
        disabled={pending}
        className="rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {pending ? "Menyimpan…" : value ? "Simpan perubahan" : "Tambah field"}
      </button>
    </form>
  );
}

export function DeleteFormFieldForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(
    deleteFormFieldAction,
    initialEnrollmentActionState,
  );
  return (
    <form
      action={action}
      className="mt-4 grid gap-2"
      onSubmit={(event) => {
        if (!window.confirm("Hapus field ini? Field yang sudah memiliki jawaban peserta tidak dapat dihapus.")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Notice state={state} />
      <button
        disabled={pending}
        className="w-fit text-sm font-semibold text-red-700 hover:underline disabled:opacity-50"
      >
        {pending ? "Menghapus…" : "Hapus field"}
      </button>
    </form>
  );
}
