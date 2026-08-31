"use client";

import { useActionState } from "react";

import {
  deleteGuardianAction,
  deleteParticipantAction,
} from "@/app/admin/(account-management)/actions";
import {
  initialAdminDeletionActionState,
  type AdminDeletionActionState,
} from "@/lib/admin-deletion/action-state";
import { deletionConfirmation } from "@/lib/admin-deletion/rules";

function ErrorNotice({ state }: { state: AdminDeletionActionState }) {
  if (!state.message) return null;
  return (
    <p
      aria-live="polite"
      className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
    >
      {state.message}
    </p>
  );
}

export function DeleteParticipantForm({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const [state, action, pending] = useActionState(
    deleteParticipantAction,
    initialAdminDeletionActionState,
  );
  const expected = deletionConfirmation(name);

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="id" value={id} />
      <p className="text-sm leading-6 text-red-950">
        Data pribadi dan seluruh jawaban formulir peserta akan dihapus permanen.
        Akun wali, saudara, ledger pembayaran, dan snapshot audit tetap disimpan.
      </p>
      <label className="text-sm font-semibold text-red-950">
        Ketik <strong>{expected}</strong>
        <input
          name="confirmation"
          autoComplete="off"
          required
          placeholder={expected}
          className="mt-1.5 w-full rounded-xl border border-red-300 bg-white px-3 py-2.5 font-normal text-slate-950"
        />
        {state.fieldErrors?.confirmation ? (
          <span className="mt-1 block text-xs text-red-700">
            {state.fieldErrors.confirmation[0]}
          </span>
        ) : null}
      </label>
      <ErrorNotice state={state} />
      <button
        disabled={pending}
        className="rounded-xl bg-red-800 px-4 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
      >
        {pending ? "Menghapus…" : "Hapus peserta permanen"}
      </button>
    </form>
  );
}

export function DeleteGuardianForm({
  id,
  email,
}: {
  id: string;
  email: string;
}) {
  const [state, action, pending] = useActionState(
    deleteGuardianAction,
    initialAdminDeletionActionState,
  );
  const expected = deletionConfirmation(email);

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="id" value={id} />
      <label className="text-xs font-semibold text-red-950">
        Ketik <strong>{expected}</strong>
        <input
          name="confirmation"
          autoComplete="off"
          required
          placeholder={expected}
          className="mt-1.5 w-full rounded-xl border border-red-300 bg-white px-3 py-2 text-sm font-normal text-slate-950"
        />
        {state.fieldErrors?.confirmation ? (
          <span className="mt-1 block text-xs text-red-700">
            {state.fieldErrors.confirmation[0]}
          </span>
        ) : null}
      </label>
      <ErrorNotice state={state} />
      <button
        disabled={pending}
        className="rounded-xl bg-red-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
      >
        {pending ? "Menghapus…" : "Hapus akun wali"}
      </button>
    </form>
  );
}
