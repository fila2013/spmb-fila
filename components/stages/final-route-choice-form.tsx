"use client";

import { useActionState } from "react";

import {
  chooseFinalRouteAction,
  initialFinalRouteChoiceActionState,
} from "@/app/anak/[id]/pengumuman/actions";
import { PilihanJalurFinal } from "@/generated/prisma/enums";

export function FinalRouteChoiceForm({
  childId,
  sourceName,
  targetName,
}: {
  childId: string;
  sourceName: string;
  targetName: string;
}) {
  const [state, action, pending] = useActionState(
    chooseFinalRouteAction,
    initialFinalRouteChoiceActionState,
  );

  return (
    <form
      action={action}
      className="mt-6 grid gap-4 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm"
    >
      <input type="hidden" name="childId" value={childId} />
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-amber-700">
          Pilihan wajib setelah diterima
        </p>
        <h2 className="mt-1 text-xl font-bold text-emerald-950">
          Pilih kelas final
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Pilihan hanya dapat dikirim satu kali dan menjadi jalur final peserta.
        </p>
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-emerald-400 hover:bg-emerald-50/40">
        <input
          type="radio"
          name="pilihan"
          value={PilihanJalurFinal.TETAP_JALUR_ASAL}
          required
          className="mt-1"
        />
        <span>
          <strong className="block text-emerald-950">
            Tetap melanjutkan {sourceName}
          </strong>
          <span className="mt-1 block text-sm leading-6 text-slate-600">
            Kuota {sourceName} yang sudah ditempati tetap digunakan.
          </span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-emerald-400 hover:bg-emerald-50/40">
        <input
          type="radio"
          name="pilihan"
          value={PilihanJalurFinal.JALUR_FALLBACK}
          required
          className="mt-1"
        />
        <span>
          <strong className="block text-emerald-950">
            Pindah ke {targetName}
          </strong>
          <span className="mt-1 block text-sm leading-6 text-slate-600">
            Kuota {sourceName} langsung dilepas. Jika {targetName} penuh,
            peserta masuk antrean sampai Admin menambah kuota.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm font-semibold leading-6 text-amber-950">
        <input type="checkbox" name="confirmation" value="SETUJU" required className="mt-1" />
        Saya memahami pilihan ini final dan tidak dapat diubah.
      </label>
      {state.message ? (
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
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Menyimpan pilihan…" : "Simpan pilihan final"}
      </button>
    </form>
  );
}
