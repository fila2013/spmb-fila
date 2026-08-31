"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { StatusPembayaran } from "@/generated/prisma/enums";
import {
  paymentReturnUrl,
  type PaymentReturnState,
} from "@/lib/payment/navigation";

type PaymentStatusResponse = {
  data: null | { status: StatusPembayaran };
};

function delay(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(resolve, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

export function PaymentReturnNotice({
  childId,
  childName,
  returnState,
}: {
  childId: string;
  childName: string;
  returnState: PaymentReturnState;
}) {
  const router = useRouter();
  const [state, setState] = useState<PaymentReturnState>(returnState);
  const [timedOut, setTimedOut] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (returnState !== "success" && returnState !== "checking") return;

    const controller = new AbortController();
    async function poll() {
      for (let attempt = 0; attempt < 30; attempt += 1) {
        if (attempt > 0) await delay(1_500, controller.signal);
        let response: Response;
        try {
          response = await fetch(
            `/api/calon-murid/${childId}/pembayaran`,
            { cache: "no-store", signal: controller.signal },
          );
        } catch (error) {
          if (controller.signal.aborted) throw error;
          continue;
        }
        if (!response.ok) continue;
        const body = (await response.json()) as PaymentStatusResponse;
        if (body.data?.status === StatusPembayaran.VERIFIED) {
          setState("verified");
          router.replace(paymentReturnUrl(childId, "verified"), {
            scroll: false,
          });
          router.refresh();
          return;
        }
        if (body.data?.status === StatusPembayaran.REJECTED) {
          setState("rejected");
          router.replace(paymentReturnUrl(childId, "rejected"), {
            scroll: false,
          });
          router.refresh();
          return;
        }
      }
      setTimedOut(true);
    }

    void poll().catch((error: unknown) => {
      if (!controller.signal.aborted) setTimedOut(true);
      if (error instanceof Error && error.name === "AbortError") return;
    });
    return () => controller.abort();
  }, [childId, returnState, retry, router]);

  if (state === "verified") {
    return (
      <section className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
        <p className="font-bold">Pembayaran {childName} terverifikasi</p>
        <p className="mt-1 text-sm leading-6">
          Webhook Midtrans sudah diterima. Tahap enrollment kini dapat dibuka
          dari kartu anak di bawah.
        </p>
      </section>
    );
  }

  if (state === "rejected") {
    return (
      <section className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-950">
        <p className="font-bold">Transaksi {childName} tidak berhasil</p>
        <p className="mt-1 text-sm leading-6">
          Transaksi ditolak atau kedaluwarsa. Silakan buat transaksi baru.
        </p>
        <Link
          href={`/anak/${childId}/pembayaran-pendaftaran`}
          className="mt-3 inline-flex text-sm font-bold underline"
        >
          Kembali ke pembayaran
        </Link>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sky-950">
      <p className="font-bold">
        {state === "success"
          ? "Pembayaran selesai di Midtrans"
          : "Memeriksa status pembayaran"}
      </p>
      <p className="mt-1 text-sm leading-6">
        {timedOut
          ? "Notifikasi belum diterima server. Status akan tetap diperbarui oleh webhook; periksa kembali beberapa saat lagi."
          : "Menunggu konfirmasi webhook Midtrans. Halaman ini memperbarui status secara otomatis."}
      </p>
      {timedOut ? (
        <button
          type="button"
          onClick={() => {
            setTimedOut(false);
            setRetry((value) => value + 1);
            router.refresh();
          }}
          className="mt-3 text-sm font-bold underline"
        >
          Periksa kembali
        </button>
      ) : (
        <span className="mt-3 inline-flex items-center gap-2 text-xs font-semibold">
          <span className="size-2 animate-pulse rounded-full bg-sky-700" />
          Sinkronisasi berjalan…
        </span>
      )}
    </section>
  );
}
