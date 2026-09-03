"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { MAX_REGISTRATION_PROOF_BYTES } from "@/lib/payment/constants";

type BankAccount = {
  id: string;
  namaBank: string;
  nomorRekening: string;
  atasNama: string;
};

async function errorMessage(response: Response) {
  const body = (await response.json().catch(() => null)) as
    | { error?: { message?: string } }
    | null;
  return body?.error?.message ?? "Bukti transfer belum dapat diproses.";
}

export function ManualRegistrationPaymentPanel({
  childId,
  bankAccounts,
}: {
  childId: string;
  bankAccounts: BankAccount[];
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setMessage("Browser tidak mengizinkan penyalinan otomatis.");
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setMessage("Pilih bukti transfer terlebih dahulu.");
      return;
    }
    if (file.size > MAX_REGISTRATION_PROOF_BYTES) {
      setMessage("Bukti transfer maksimal 500 KB.");
      return;
    }
    setPending(true);
    setMessage(null);
    const formData = new FormData();
    formData.set("bukti", file);
    try {
      const response = await fetch(
        `/api/calon-murid/${childId}/pembayaran/manual`,
        { method: "POST", body: formData },
      );
      if (!response.ok) throw new Error(await errorMessage(response));
      router.replace(`/anak/${childId}/enrollment/data-pribadi`);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Bukti transfer belum dapat diproses.",
      );
      setPending(false);
    }
  }

  return (
    <div className="mt-7 grid gap-5">
      <div>
        <h2 className="text-lg font-bold text-emerald-950">Transfer ke rekening sekolah</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Transfer sesuai nominal di atas, lalu unggah bukti agar formulir pendaftaran langsung terbuka.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {bankAccounts.map((account) => (
          <article key={account.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-lg font-bold text-emerald-950">{account.namaBank}</p>
            <div className="mt-3 grid gap-3 text-sm">
              <div>
                <p className="text-slate-500">Nomor rekening</p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <strong className="break-all text-base text-slate-900">{account.nomorRekening}</strong>
                  <button type="button" onClick={() => copy(account.nomorRekening, `${account.id}-number`)} className="shrink-0 rounded-lg border border-emerald-700 px-2.5 py-1.5 font-bold text-emerald-800 hover:bg-emerald-50">
                    {copied === `${account.id}-number` ? "Tersalin" : "Salin"}
                  </button>
                </div>
              </div>
              <div>
                <p className="text-slate-500">Atas nama</p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <strong className="text-slate-900">{account.atasNama}</strong>
                  <button type="button" onClick={() => copy(account.atasNama, `${account.id}-name`)} className="shrink-0 rounded-lg border border-emerald-700 px-2.5 py-1.5 font-bold text-emerald-800 hover:bg-emerald-50">
                    {copied === `${account.id}-name` ? "Tersalin" : "Salin"}
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
      <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <label className="text-sm font-bold text-emerald-950">
          Bukti transfer
          <input
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            required
            disabled={pending}
            onChange={(event) => {
              const nextFile = event.target.files?.[0] ?? null;
              setFile(nextFile);
              setMessage(
                nextFile && nextFile.size > MAX_REGISTRATION_PROOF_BYTES
                  ? "Bukti transfer maksimal 500 KB."
                  : null,
              );
            }}
            className="mt-2 block w-full rounded-xl border border-emerald-900/20 bg-white px-3 py-2.5 font-normal file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-900 file:px-3 file:py-2 file:font-bold file:text-white"
          />
          <span className="mt-1.5 block text-xs font-normal leading-5 text-slate-600">
            Format JPG, PNG, atau PDF. Ukuran maksimal 500 KB.
          </span>
        </label>
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
          Dengan mengirim bukti, pembayaran langsung ditandai terverifikasi dan Anda dapat melanjutkan formulir enrollment.
        </p>
        {message ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{message}</p> : null}
        <button disabled={pending || !file || Boolean(file && file.size > MAX_REGISTRATION_PROOF_BYTES)} className="rounded-xl bg-emerald-900 px-5 py-3 font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60">
          {pending ? "Mengunggah dan memverifikasi…" : "Kirim bukti & lanjutkan"}
        </button>
      </form>
    </div>
  );
}
