"use client";

import { useActionState } from "react";

import {
  updateWhatsappInvitationAction,
  verifyAdmissionPaymentAction,
} from "@/app/admin/(admission)/actions";
import { StatusPembayaran, StatusUndanganWa } from "@/generated/prisma/enums";
import { initialStageActionState, type StageActionState } from "@/lib/stages/action-state";

function Notice({ state }: { state: StageActionState }) {
  if (!state.message) return null;
  return <p aria-live="polite" className={`rounded-xl border px-3 py-2 text-sm ${state.status === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800"}`}>{state.message}</p>;
}

export function AdmissionVerificationForm({ childId, paymentId }: { childId: string; paymentId: string }) {
  const [state, action, pending] = useActionState(verifyAdmissionPaymentAction, initialStageActionState);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="childId" value={childId} />
      <input type="hidden" name="paymentId" value={paymentId} />
      <label className="text-sm font-semibold text-slate-800">Keputusan
        <select name="status" required defaultValue={StatusPembayaran.VERIFIED} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal">
          <option value={StatusPembayaran.VERIFIED}>Verifikasi</option>
          <option value={StatusPembayaran.REJECTED}>Tolak</option>
        </select>
      </label>
      <label className="text-sm font-semibold text-slate-800">Nominal aktual pada bukti
        <input name="nominal" type="number" min={1} max={2_147_483_647} placeholder="Contoh: 5000000" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" />
        <span className="mt-1 block text-xs font-normal text-slate-500">Wajib untuk verifikasi; boleh kosong saat menolak.</span>
      </label>
      <label className="text-sm font-semibold text-slate-800">Catatan admin
        <textarea name="catatanAdmin" rows={3} maxLength={2000} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" />
        <span className="mt-1 block text-xs font-normal text-slate-500">Alasan wajib diisi jika bukti ditolak.</span>
      </label>
      <Notice state={state} />
      <button disabled={pending} className="rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{pending ? "Menyimpan…" : "Simpan keputusan DU"}</button>
    </form>
  );
}

export function WhatsappInvitationForm({ childId, status }: { childId: string; status: StatusUndanganWa }) {
  const [state, action, pending] = useActionState(updateWhatsappInvitationAction, initialStageActionState);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="childId" value={childId} />
      <label className="text-sm font-semibold text-slate-800">Status undangan grup
        <select name="status" defaultValue={status} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal">
          <option value={StatusUndanganWa.MENUNGGU}>Menunggu diundang</option>
          <option value={StatusUndanganWa.SUDAH_DIUNDANG}>Sudah diundang</option>
        </select>
      </label>
      <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">Sistem hanya mencatat status. Undangan WhatsApp tetap dilakukan manual oleh panitia.</p>
      <Notice state={state} />
      <button disabled={pending} className="rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{pending ? "Menyimpan…" : "Simpan status WhatsApp"}</button>
    </form>
  );
}
