"use client";

import { useActionState } from "react";

import { reprocessFallbackQueueAction } from "@/app/admin/(fallback)/actions";
import { initialStageActionState } from "@/lib/stages/action-state";

export function ReprocessFallbackButton({ jalurId }: { jalurId: string }) {
  const [state, action, pending] = useActionState(
    reprocessFallbackQueueAction,
    initialStageActionState,
  );
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="id" value={jalurId} />
      <button
        disabled={pending}
        className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-950 hover:bg-amber-100 disabled:opacity-60"
      >
        {pending ? "Memproses…" : "Proses ulang antrian"}
      </button>
      {state.message ? (
        <p
          aria-live="polite"
          className={`text-xs ${state.status === "success" ? "text-emerald-800" : "text-red-700"}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
