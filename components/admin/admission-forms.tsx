"use client";

import { useActionState, useState } from "react";

import {
  updateWhatsappInvitationAction,
  verifyAdmissionPaymentAction,
} from "@/app/admin/(admission)/actions";
import { StatusPembayaran } from "@/generated/prisma/enums";
import { initialStageActionState, type StageActionState } from "@/lib/stages/action-state";

function Notice({ state }: { state: StageActionState }) {
  if (!state.message) return null;
  return <p aria-live="polite" className={`rounded-xl border px-3 py-2 text-sm ${state.status === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800"}`}>{state.message}</p>;
}

export function AdmissionVerificationForm({ childId, paymentId }: { childId: string; paymentId: string }) {
  const [state, action, pending] = useActionState(verifyAdmissionPaymentAction, initialStageActionState);
  const [decision, setDecision] = useState<StatusPembayaran>(StatusPembayaran.VERIFIED);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="childId" value={childId} />
      <input type="hidden" name="paymentId" value={paymentId} />
      <label className="text-sm font-semibold text-slate-800">Keputusan
        <select name="status" required value={decision} onChange={(event) => setDecision(event.target.value as StatusPembayaran)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal">
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
      {decision === StatusPembayaran.VERIFIED ? (
        <label className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
          <input name="proofReviewed" value="true" type="checkbox" required className="mt-0.5 size-4" />
          <span>Saya sudah membuka dan memeriksa preview bukti pembayaran DU.</span>
        </label>
      ) : null}
      <Notice state={state} />
      <button disabled={pending} className="rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{pending ? "Menyimpan…" : "Simpan keputusan DU"}</button>
    </form>
  );
}

export function WhatsappInvitationForm({
  childId,
  inviteUrl,
  confirmed,
  confirmedAt,
}: {
  childId: string;
  inviteUrl: string;
  confirmed: boolean;
  confirmedAt: Date | null;
}) {
  const [state, action, pending] = useActionState(updateWhatsappInvitationAction, initialStageActionState);
  if (confirmed) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
        <p className="font-bold">Wali sudah mengonfirmasi bergabung.</p>
        <p className="mt-1">Pendaftaran telah selesai{confirmedAt ? ` pada ${confirmedAt.toLocaleString("id-ID")}` : ""}.</p>
      </div>
    );
  }
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="childId" value={childId} />
      <label className="text-sm font-semibold text-slate-800">Link undangan grup WhatsApp
        <input
          name="inviteUrl"
          type="url"
          required
          defaultValue={inviteUrl}
          placeholder="https://chat.whatsapp.com/..."
          className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal"
        />
      </label>
      <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">Link baru akan menggantikan link sebelumnya dan mengharuskan wali membukanya kembali. Pendaftaran baru selesai setelah wali mengonfirmasi sudah bergabung.</p>
      <Notice state={state} />
      <button disabled={pending} className="rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{pending ? "Menyimpan…" : inviteUrl ? "Perbarui link WhatsApp" : "Simpan link WhatsApp"}</button>
    </form>
  );
}
