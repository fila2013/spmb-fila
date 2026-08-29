"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { StatusPembayaran } from "@/generated/prisma/enums";

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        callbacks: {
          onSuccess: () => void;
          onPending: () => void;
          onError: () => void;
          onClose: () => void;
        },
      ) => void;
    };
  }
}

type PaymentStatusResponse = {
  data: null | {
    status: StatusPembayaran;
    orderId: string | null;
    paymentType: string | null;
  };
  error?: { message?: string };
};

type CreatePaymentResponse = {
  data?: {
    snapToken: string;
    status: StatusPembayaran;
    environment: "sandbox" | "production";
  };
  error?: { message?: string };
};

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function SnapPaymentPanel({
  childId,
  clientKey,
  snapScriptUrl,
  initialStatus,
  initialSnapToken,
  environment,
}: {
  childId: string;
  clientKey: string;
  snapScriptUrl: string;
  initialStatus: StatusPembayaran | null;
  initialSnapToken: string | null;
  environment: "sandbox" | "production";
}) {
  const router = useRouter();
  const environmentLabel = environment === "sandbox" ? "Sandbox" : "Production";
  const [scriptReady, setScriptReady] = useState(false);
  const [status, setStatus] = useState(initialStatus);
  const [snapToken, setSnapToken] = useState(initialSnapToken);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function pollStatus() {
    for (let attempt = 0; attempt < 15; attempt += 1) {
      await delay(attempt === 0 ? 700 : 2_000);
      const response = await fetch(
        `/api/calon-murid/${childId}/pembayaran`,
        { cache: "no-store" },
      );
      if (!response.ok) continue;
      const body = (await response.json()) as PaymentStatusResponse;
      if (!body.data) continue;
      setStatus(body.data.status);
      if (body.data.status === StatusPembayaran.VERIFIED) {
        setMessage("Pembayaran terverifikasi. Tahap enrollment sudah terbuka.");
        router.refresh();
        return;
      }
      if (body.data.status === StatusPembayaran.REJECTED) {
        setMessage("Transaksi ditolak atau kedaluwarsa. Buat transaksi baru untuk mencoba kembali.");
        setSnapToken(null);
        router.refresh();
        return;
      }
    }
    setMessage("Status masih diproses. Halaman ini dapat diperiksa kembali beberapa saat lagi.");
  }

  async function openSnap() {
    setBusy(true);
    setMessage(null);
    try {
      let token = snapToken;
      if (!token || status === StatusPembayaran.REJECTED) {
        const response = await fetch(
          `/api/calon-murid/${childId}/pembayaran/midtrans/create`,
          { method: "POST" },
        );
        const body = (await response.json()) as CreatePaymentResponse;
        if (!response.ok || !body.data) {
          throw new Error(
            body.error?.message ??
              `Transaksi ${environmentLabel} belum dapat dibuat.`,
          );
        }
        token = body.data.snapToken;
        setSnapToken(token);
        setStatus(body.data.status);
      }

      if (!scriptReady || !window.snap) {
        throw new Error(
          `Snap ${environmentLabel} belum selesai dimuat. Silakan coba kembali.`,
        );
      }
      window.snap.pay(token, {
        onSuccess: () => {
          setMessage("Pembayaran selesai di Snap. Menunggu konfirmasi webhook…");
          void pollStatus();
        },
        onPending: () => {
          setStatus(StatusPembayaran.PENDING);
          setMessage("Transaksi menunggu pembayaran atau konfirmasi Midtrans.");
          void pollStatus();
        },
        onError: () => {
          setMessage("Snap melaporkan transaksi gagal. Status server sedang diperiksa.");
          void pollStatus();
        },
        onClose: () => {
          setMessage("Jendela pembayaran ditutup. Transaksi pending tetap dapat dilanjutkan.");
          setBusy(false);
        },
      });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Pembayaran belum dapat dibuka.",
      );
    } finally {
      setBusy(false);
    }
  }

  const verified = status === StatusPembayaran.VERIFIED;
  const rejected = status === StatusPembayaran.REJECTED;

  return (
    <div className="mt-6 grid gap-4">
      <Script
        src={snapScriptUrl}
        data-client-key={clientKey}
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() =>
          setMessage(
            `Snap ${environmentLabel} gagal dimuat. Periksa koneksi lalu coba kembali.`,
          )
        }
      />
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        <p className="font-bold">
          Mode {environmentLabel}
        </p>
        <p>
          {environment === "sandbox"
            ? "Transaksi ini hanya untuk pengujian. Jangan membayar memakai rekening atau dana nyata."
            : "Transaksi ini menggunakan lingkungan pembayaran production."}
        </p>
      </div>

      {verified ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
          <p className="font-bold">Pembayaran terverifikasi</p>
          <p className="mt-1 text-sm">Webhook Midtrans telah membuka tahap enrollment.</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={openSnap}
          disabled={busy || !scriptReady}
          className="w-full rounded-xl bg-emerald-900 px-5 py-3.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
        >
          {busy
            ? "Menyiapkan pembayaran…"
            : rejected
              ? `Buat transaksi ${environmentLabel} baru`
              : snapToken
                ? `Lanjutkan pembayaran ${environmentLabel}`
                : `Bayar melalui Midtrans ${environmentLabel}`}
        </button>
      )}

      {message ? (
        <p aria-live="polite" className="rounded-xl bg-slate-100 px-4 py-3 text-sm leading-6 text-slate-700">
          {message}
        </p>
      ) : null}
    </div>
  );
}
