"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { StatusUndanganWa } from "@/generated/prisma/enums";

export function WhatsappJoinPanel({
  childId,
  status,
  hasInviteLink,
  linkWasOpened,
  confirmedAt,
}: {
  childId: string;
  status: StatusUndanganWa;
  hasInviteLink: boolean;
  linkWasOpened: boolean;
  confirmedAt: Date | null;
}) {
  const router = useRouter();
  const [opened, setOpened] = useState(linkWasOpened);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const confirmed = status === StatusUndanganWa.SUDAH_DIUNDANG;

  async function confirmMembership() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/calon-murid/${childId}/status-wa`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmed: true }),
      });
      const body = await response.json() as { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(body.error?.message ?? "Konfirmasi belum dapat disimpan.");
      }
      setMessage("Konfirmasi tersimpan. Pendaftaran telah selesai.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Konfirmasi belum dapat disimpan.");
    } finally {
      setPending(false);
    }
  }

  if (confirmed) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
        <h2 className="font-bold">Pendaftaran selesai</h2>
        <p className="mt-1 text-sm leading-6">Anda telah mengonfirmasi bergabung ke grup WhatsApp{confirmedAt ? ` pada ${confirmedAt.toLocaleString("id-ID")}` : ""}.</p>
      </div>
    );
  }

  if (!hasInviteLink) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
        <h2 className="font-bold">Menunggu link grup</h2>
        <p className="mt-1 text-sm leading-6">Pembayaran DU sudah terverifikasi. Panitia sedang menyiapkan link grup WhatsApp.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 rounded-2xl border border-emerald-200 bg-white p-5">
      <div>
        <h2 className="font-bold text-emerald-950">Link grup sudah tersedia</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">Klik tombol berikut untuk membuka WhatsApp. Setelah berhasil masuk grup, kembali ke halaman ini dan lakukan konfirmasi.</p>
      </div>
      <a
        href={`/api/calon-murid/${childId}/status-wa/join`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => setOpened(true)}
        className="inline-flex justify-center rounded-xl bg-emerald-900 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-800"
      >
        Buka grup WhatsApp
      </a>
      <div className="border-t border-slate-200 pt-4">
        <p className="text-sm font-semibold text-slate-800">Sudah berhasil bergabung ke grup?</p>
        <button
          type="button"
          disabled={!opened || pending}
          onClick={confirmMembership}
          className="mt-3 w-full rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-amber-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Menyimpan konfirmasi…" : "Iya, saya sudah masuk"}
        </button>
        {!opened ? <p className="mt-2 text-xs text-slate-500">Tombol konfirmasi aktif setelah link grup dibuka.</p> : null}
      </div>
      {message ? <p aria-live="polite" className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</p> : null}
    </div>
  );
}
