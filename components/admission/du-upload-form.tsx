"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function DuUploadForm({ childId }: { childId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setSuccess(false);
    try {
      const response = await fetch(`/api/calon-murid/${childId}/du`, {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const body = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Bukti pembayaran belum dapat dikirim.");
      setSuccess(true);
      setMessage("Bukti pembayaran DU berhasil dikirim dan menunggu verifikasi admin.");
      event.currentTarget.reset();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bukti pembayaran belum dapat dikirim.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-emerald-950/10 bg-white p-5">
      <div>
        <h2 className="font-bold text-emerald-950">Unggah bukti pembayaran DU</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">Format JPG, PNG, atau PDF dengan ukuran maksimal 5 MB.</p>
      </div>
      <input
        name="bukti"
        type="file"
        required
        accept="image/jpeg,image/png,application/pdf"
        className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
      />
      {message ? (
        <p aria-live="polite" className={`rounded-xl border px-3 py-2 text-sm ${success ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800"}`}>{message}</p>
      ) : null}
      <button disabled={pending} className="rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60">
        {pending ? "Mengunggah…" : "Kirim bukti pembayaran DU"}
      </button>
    </form>
  );
}
