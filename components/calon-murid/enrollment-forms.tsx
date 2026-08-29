"use client";

import { useActionState, useState } from "react";

import {
  createChildWithRouteAction,
  selectCategoryAction,
} from "@/app/anak/actions";
import {
  KategoriTipe,
  SubKategoriAlumni,
} from "@/generated/prisma/enums";
import { initialCalonMuridActionState } from "@/lib/calon-murid/action-state";

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

export function AddChildForm({ routes }: { routes: Choice[] }) {
  const [state, action, pending] = useActionState(
    createChildWithRouteAction,
    initialCalonMuridActionState,
  );
  const hasAvailableRoute = routes.some((route) => route.available);

  return (
    <form action={action} className="grid gap-6">
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
      <button
        disabled={pending || !hasAvailableRoute}
        className="rounded-xl bg-emerald-900 px-5 py-3.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Menyimpan pilihan…" : "Lanjut pilih kategori"}
      </button>
    </form>
  );
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
