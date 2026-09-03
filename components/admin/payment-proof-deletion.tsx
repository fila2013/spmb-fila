"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

async function responseMessage(response: Response) {
  const body = (await response.json().catch(() => null)) as
    | { error?: { message?: string } }
    | null;
  return body?.error?.message ?? "File bukti belum dapat dihapus.";
}

export function PaymentProofDeletion({
  paymentId,
}: {
  paymentId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function removeProof() {
    if (
      !window.confirm(
        "Pastikan bukti sudah diperiksa. Hapus file bukti secara permanen? Record transaksi, nominal, dan status pembayaran tetap disimpan.",
      )
    ) {
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/admin/pembayaran/${paymentId}/bukti`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error(await responseMessage(response));
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "File bukti belum dapat dihapus.",
      );
      setPending(false);
    }
  }

  return (
    <div className="mt-3 grid gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={removeProof}
        className="justify-self-start rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60"
      >
        {pending ? "Menghapus file…" : "Hapus file bukti"}
      </button>
      {message ? (
        <p role="alert" className="text-sm text-red-700">{message}</p>
      ) : null}
    </div>
  );
}
