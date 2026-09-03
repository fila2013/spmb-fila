"use client";

import { useActionState } from "react";

import {
  deleteBankAccountAction,
  saveBankAccountAction,
  updatePaymentModeAction,
} from "@/app/admin/settings/actions";
import { ModePembayaranPendaftaran } from "@/generated/prisma/enums";
import {
  initialMasterDataActionState,
  type MasterDataActionState,
} from "@/lib/master-data/action-state";

function Notice({ state }: { state: MasterDataActionState }) {
  if (!state.message) return null;
  return (
    <p aria-live="polite" className={`rounded-xl border px-3 py-2 text-sm ${state.status === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800"}`}>
      {state.message}
    </p>
  );
}

export function PaymentModeForm({ mode }: { mode: ModePembayaranPendaftaran }) {
  const [state, action, pending] = useActionState(
    updatePaymentModeAction,
    initialMasterDataActionState,
  );
  return (
    <form action={action} className="grid gap-4">
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Mode pembayaran aktif</legend>
        {[
          { value: ModePembayaranPendaftaran.MIDTRANS, title: "Payment Gateway", detail: "Pembayaran melalui Midtrans Snap dan status final dari webhook." },
          { value: ModePembayaranPendaftaran.MANUAL, title: "Transfer Manual", detail: "Upload bukti maksimal 500 KB langsung membuka enrollment." },
        ].map((option) => (
          <label key={option.value} className="flex cursor-pointer gap-3 rounded-2xl border border-slate-200 p-4 has-[:checked]:border-emerald-700 has-[:checked]:bg-emerald-50">
            <input type="radio" name="mode" value={option.value} defaultChecked={mode === option.value} className="mt-1 size-4" />
            <span><span className="block font-bold text-emerald-950">{option.title}</span><span className="mt-1 block text-sm leading-6 text-slate-600">{option.detail}</span></span>
          </label>
        ))}
      </fieldset>
      <Notice state={state} />
      <button disabled={pending} className="rounded-xl bg-emerald-900 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60">{pending ? "Menyimpan…" : "Simpan mode pembayaran"}</button>
    </form>
  );
}

export function BankAccountForm({
  value,
}: {
  value?: { id: string; namaBank: string; nomorRekening: string; atasNama: string };
}) {
  const [state, action, pending] = useActionState(
    saveBankAccountAction,
    initialMasterDataActionState,
  );
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="id" value={value?.id ?? ""} />
      <label className="text-sm font-semibold text-slate-800">Nama bank
        <input name="namaBank" required maxLength={100} defaultValue={value?.namaBank} placeholder="Contoh: BSI" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" />
      </label>
      <label className="text-sm font-semibold text-slate-800">Nomor rekening
        <input name="nomorRekening" required inputMode="numeric" maxLength={40} defaultValue={value?.nomorRekening} placeholder="Contoh: 7123456789" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" />
        <span className="mt-1 block text-xs font-normal text-slate-500">Spasi, titik, dan tanda hubung akan dihapus otomatis.</span>
      </label>
      <label className="text-sm font-semibold text-slate-800">Atas nama
        <input name="atasNama" required maxLength={150} defaultValue={value?.atasNama} placeholder="SDIT Fitrah Insani" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" />
      </label>
      <Notice state={state} />
      <button disabled={pending} className="rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{pending ? "Menyimpan…" : value ? "Simpan perubahan rekening" : "Tambah rekening"}</button>
    </form>
  );
}

export function DeleteBankAccountForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(
    deleteBankAccountAction,
    initialMasterDataActionState,
  );
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="id" value={id} />
      <button disabled={pending} className="rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60">{pending ? "Menghapus…" : "Hapus rekening"}</button>
      <Notice state={state} />
    </form>
  );
}
