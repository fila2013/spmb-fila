"use client";

import { useActionState } from "react";

import {
  createFormFieldAction,
  deleteFormFieldAction,
  updateFormFieldAction,
} from "@/app/admin/(enrollment)/actions";
import type { FormField } from "@/generated/prisma/client";
import { FormType, TipeInput } from "@/generated/prisma/enums";
import { initialEnrollmentActionState } from "@/lib/enrollment/action-state";

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
};

export function FormFieldForm({ value }: { value?: FormField }) {
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
            defaultValue={value?.tipeInput ?? TipeInput.TEXT}
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
        <label className="text-sm font-semibold text-slate-800">
          Validasi
          <select
            name="validasi"
            defaultValue={value?.validasi ?? ""}
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal"
          >
            <option value="">Tidak ada</option>
            <option value="format_wa_indonesia">Nomor WA Indonesia</option>
          </select>
        </label>
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
          </select>
        </label>
      </div>
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
