"use client";

import { useActionState, useState } from "react";

import {
  createChildWithRouteAction,
  selectCategoryAction,
  updateBirthDetailsAction,
} from "@/app/anak/actions";
import {
  KategoriTipe,
  SubKategoriAlumni,
  TipeInput,
} from "@/generated/prisma/enums";
import { initialCalonMuridActionState } from "@/lib/calon-murid/action-state";
import { ageRequirementText, fieldValueError } from "@/lib/enrollment/rules";

type AgeRule = { minAgeYears: number | null; ageReferenceMonth: number | null; ageReferenceYear: number | null } | null;

function birthDateLabel(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) return null;
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

type Choice = {
  id: string;
  nama: string;
  available: boolean;
  availabilityLabel: string;
  quotaLabel: string;
};

function Notice({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      aria-live="polite"
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      {message}
    </p>
  );
}

function ChoiceCard({ choice, name }: { choice: Choice; name: string }) {
  return (
    <label
      className={`flex items-start gap-3 rounded-2xl border p-4 transition ${
        choice.available
          ? "cursor-pointer border-slate-200 bg-white hover:border-emerald-700 hover:bg-emerald-50/40"
          : "cursor-not-allowed border-slate-200 bg-slate-50 opacity-65"
      }`}
    >
      <input
        className="mt-1 size-4 accent-emerald-800"
        type="radio"
        name={name}
        value={choice.id}
        disabled={!choice.available}
        required
      />
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-emerald-950">{choice.nama}</span>
        <span className="mt-1 block text-sm text-slate-600">
          {choice.availabilityLabel} · {choice.quotaLabel}
        </span>
      </span>
    </label>
  );
}

export function AddChildForm({ routes, ageRule }: { routes: Choice[]; ageRule: AgeRule }) {
  const [state, action, pending] = useActionState(
    createChildWithRouteAction,
    initialCalonMuridActionState,
  );
  const hasAvailableRoute = routes.some((route) => route.available);
  const [tanggalLahir, setTanggalLahir] = useState("");
  const [birthError, setBirthError] = useState<string | null>(null);
  const birthField = { id: "tanggalLahir", tipeInput: TipeInput.DATE, wajib: true, validasi: null, ...(ageRule ?? {}) };
  const ageText = ageRequirementText(birthField);

  return (
    <form action={action} className="grid gap-6" onSubmit={(event) => {
      const error = fieldValueError(birthField, tanggalLahir, true);
      if (error) { event.preventDefault(); setBirthError(error); }
    }}>
      <label className="block text-sm font-semibold text-slate-800">
        Nama lengkap anak
        <input
          name="namaAnak"
          required
          maxLength={150}
          aria-invalid={Boolean(state.fieldErrors?.namaAnak)}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal text-slate-950 outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10"
          placeholder="Contoh: Aisyah Fitrah"
        />
        {state.fieldErrors?.namaAnak ? (
          <span className="mt-1 block text-xs text-red-700">
            {state.fieldErrors.namaAnak[0]}
          </span>
        ) : null}
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-slate-800">Tempat lahir
          <input name="tempatLahir" required minLength={2} maxLength={150} aria-invalid={Boolean(state.fieldErrors?.tempatLahir)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal text-slate-950 outline-none focus:border-emerald-700" placeholder="Contoh: Bandar Lampung" />
          {state.fieldErrors?.tempatLahir ? <span className="mt-1 block text-xs text-red-700">{state.fieldErrors.tempatLahir[0]}</span> : null}
        </label>
        <label className="block text-sm font-semibold text-slate-800">Tanggal lahir
          <input name="tanggalLahir" type="date" required value={tanggalLahir} onChange={(event) => { setTanggalLahir(event.target.value); setBirthError(null); }} onBlur={() => setBirthError(fieldValueError(birthField, tanggalLahir, true))} aria-invalid={Boolean(birthError || state.fieldErrors?.tanggalLahir)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal text-slate-950 outline-none focus:border-emerald-700" />
          {birthDateLabel(tanggalLahir) ? <span className="mt-1 block text-xs font-normal text-slate-600">Tanggal dipilih: {birthDateLabel(tanggalLahir)}.</span> : null}
          {ageText ? <span className="mt-1 block text-xs font-normal text-slate-600">Syarat: {ageText}.</span> : null}
          {birthError || state.fieldErrors?.tanggalLahir ? <span className="mt-1 block text-xs text-red-700">{birthError ?? state.fieldErrors?.tanggalLahir?.[0]}</span> : null}
        </label>
      </div>
      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm font-semibold text-slate-800">
          Pilih jalur pendaftaran
        </legend>
        {routes.length ? (
          routes.map((route) => (
            <ChoiceCard key={route.id} choice={route} name="jalurId" />
          ))
        ) : (
          <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            Belum ada jalur pendaftaran yang tersedia.
          </p>
        )}
      </fieldset>
      <Notice message={state.message} />
      {!ageRule ? <Notice message="Aturan usia pendaftaran belum dikonfigurasi. Hubungi admin sebelum melanjutkan." /> : null}
      <button
        disabled={pending || !hasAvailableRoute || !ageRule}
        className="rounded-xl bg-emerald-900 px-5 py-3.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Menyimpan pilihan…" : "Lanjut pilih kategori"}
      </button>
    </form>
  );
}

export function BirthDetailsForm({ childId, tempatLahir, tanggalLahir, ageRule }: {
  childId: string;
  tempatLahir: string | null;
  tanggalLahir: string | null;
  ageRule: AgeRule;
}) {
  const [state, action, pending] = useActionState(updateBirthDetailsAction, initialCalonMuridActionState);
  const [date, setDate] = useState(tanggalLahir ?? "");
  const [dateError, setDateError] = useState<string | null>(null);
  const birthField = { id: "tanggalLahir", tipeInput: TipeInput.DATE, wajib: true, validasi: null, ...(ageRule ?? {}) };
  return <form action={action} className="grid gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5" onSubmit={(event) => {
    const error = fieldValueError(birthField, date, true);
    if (error) { event.preventDefault(); setDateError(error); }
  }}>
    <input type="hidden" name="calonMuridId" value={childId} />
    <p className="text-sm font-semibold text-amber-950">Data lahir sebelum pembayaran</p>
    <p className="text-sm text-amber-900">Data pendaftaran lama atau koreksi awal dapat dilengkapi di sini sebelum kuota ditahan.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-semibold text-slate-800">Tempat lahir
        <input name="tempatLahir" required minLength={2} maxLength={150} defaultValue={tempatLahir ?? ""} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal" />
        {state.fieldErrors?.tempatLahir ? <span className="mt-1 block text-xs text-red-700">{state.fieldErrors.tempatLahir[0]}</span> : null}
      </label>
      <label className="text-sm font-semibold text-slate-800">Tanggal lahir
        <input name="tanggalLahir" type="date" required value={date} onChange={(event) => { setDate(event.target.value); setDateError(null); }} onBlur={() => setDateError(fieldValueError(birthField, date, true))} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal" />
        {birthDateLabel(date) ? <span className="mt-1 block text-xs font-normal text-slate-600">Tanggal dipilih: {birthDateLabel(date)}.</span> : null}
        {ageRequirementText(birthField) ? <span className="mt-1 block text-xs font-normal text-slate-600">Syarat: {ageRequirementText(birthField)}.</span> : null}
        {dateError || state.fieldErrors?.tanggalLahir ? <span className="mt-1 block text-xs text-red-700">{dateError ?? state.fieldErrors?.tanggalLahir?.[0]}</span> : null}
      </label>
    </div>
    <Notice message={state.message} />
    <button disabled={pending} className="w-fit rounded-xl bg-emerald-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{pending ? "Menyimpan…" : "Simpan data lahir"}</button>
  </form>;
}

type CategoryChoice = Choice & {
  tipe: KategoriTipe;
  feeConfigured: boolean;
  feeLabel: string | null;
};

export function SelectCategoryForm({
  childId,
  categories,
}: {
  childId: string;
  categories: CategoryChoice[];
}) {
  const [state, action, pending] = useActionState(
    selectCategoryAction,
    initialCalonMuridActionState,
  );
  const [selectedId, setSelectedId] = useState("");
  const selected = categories.find((item) => item.id === selectedId);

  return (
    <form action={action} className="grid gap-6">
      <input type="hidden" name="calonMuridId" value={childId} />
      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm font-semibold text-slate-800">
          Kategori pendaftar
        </legend>
        {categories.map((category) => {
          const available = category.available && category.feeConfigured;
          return (
            <label
              key={category.id}
              className={`flex items-start gap-3 rounded-2xl border p-4 ${
                available
                  ? "cursor-pointer border-slate-200 bg-white hover:border-emerald-700"
                  : "cursor-not-allowed bg-slate-50 opacity-65"
              }`}
            >
              <input
                className="mt-1 size-4 accent-emerald-800"
                type="radio"
                name="kategoriId"
                value={category.id}
                disabled={!available}
                required
                onChange={() => setSelectedId(category.id)}
              />
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-emerald-950">
                  {category.nama}
                </span>
                <span className="mt-1 block text-sm text-slate-600">
                  {category.feeConfigured
                    ? `${category.availabilityLabel} · ${category.quotaLabel} · ${category.feeLabel}`
                    : "Biaya belum diatur admin"}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {selected?.tipe === KategoriTipe.ALUMNI_TKFI ? (
        <fieldset className="grid gap-3 rounded-2xl bg-emerald-50 p-4">
          <legend className="px-1 text-sm font-semibold text-emerald-950">
            Asal TKIT Fitrah Insani
          </legend>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="radio" name="subKategoriEnum" required value={SubKategoriAlumni.TKIT_FI_1} />
            TKIT Fitrah Insani 1
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="radio" name="subKategoriEnum" required value={SubKategoriAlumni.TKIT_FI_2} />
            TKIT Fitrah Insani 2
          </label>
        </fieldset>
      ) : null}

      {selected?.tipe === KategoriTipe.EKSTERNAL ? (
        <label className="block text-sm font-semibold text-slate-800">
          Nama asal TK
          <input
            name="subKategoriText"
            required
            maxLength={150}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10"
            placeholder="Contoh: TK Harapan Bangsa"
          />
        </label>
      ) : null}

      <Notice message={state.message} />
      <button
        disabled={pending || !selected}
        className="rounded-xl bg-emerald-900 px-5 py-3.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Menyimpan kategori…" : "Lanjut ke pembayaran"}
      </button>
    </form>
  );
}
