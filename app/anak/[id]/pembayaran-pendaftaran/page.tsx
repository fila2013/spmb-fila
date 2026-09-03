import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SnapPaymentPanel } from "@/components/payment/snap-payment-panel";
import { ManualRegistrationPaymentPanel } from "@/components/payment/manual-registration-payment-panel";
import {
  ModePembayaranPendaftaran,
  MetodePembayaran,
  StatusPembayaran,
} from "@/generated/prisma/enums";
import { AuthorizationError } from "@/lib/auth/errors";
import { requireWaliPage } from "@/lib/auth/navigation";
import { CalonMuridError } from "@/lib/calon-murid/errors";
import { getAppEnvironment } from "@/lib/env/client";
import { getMidtransEnvironment } from "@/lib/env/server";
import { PaymentError } from "@/lib/payment/errors";
import { paymentReturnUrl } from "@/lib/payment/navigation";
import { midtransUrls } from "@/lib/payment/rules";
import { getRegistrationPaymentPageData } from "@/lib/payment/service";

export const metadata: Metadata = { title: "Pembayaran pendaftaran" };

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function PaymentPreparationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireWaliPage();
  const { id } = await params;
  let summary;
  try {
    summary = await getRegistrationPaymentPageData(id, user.userId);
  } catch (error) {
    if (
      error instanceof AuthorizationError ||
      error instanceof CalonMuridError ||
      error instanceof PaymentError
    ) {
      notFound();
    }
    throw error;
  }

  const { child, payment, nominal, mode, bankAccounts } = summary;
  if (payment?.status === StatusPembayaran.VERIFIED) {
    redirect(paymentReturnUrl(child.id, "verified"));
  }
  const subCategory = child.subKategoriEnum
    ? child.subKategoriEnum === "TKIT_FI_1"
      ? "TKIT Fitrah Insani 1"
      : "TKIT Fitrah Insani 2"
    : child.subKategoriText;
  const midtrans =
    mode === ModePembayaranPendaftaran.MIDTRANS
      ? getMidtransEnvironment()
      : null;
  const urls = midtrans
    ? midtransUrls(midtrans.MIDTRANS_IS_PRODUCTION)
    : null;
  const localWebhookWarning = midtrans && urls
    ? urls.environment === "sandbox" &&
      !midtrans.MIDTRANS_NOTIFICATION_URL &&
      ["localhost", "127.0.0.1", "::1"].includes(
        new URL(getAppEnvironment().NEXT_PUBLIC_APP_URL).hostname,
      )
    : false;

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-12">
      <Link
        href="/dashboard"
        className="text-sm font-semibold text-emerald-800 hover:underline"
      >
        ← Kembali ke Anak Saya
      </Link>
      <section className="mt-6 overflow-hidden rounded-3xl border border-emerald-950/10 bg-white shadow-sm">
        <div className="bg-emerald-950 px-6 py-7 text-white sm:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.17em] text-amber-300">
            Ringkasan pendaftaran
          </p>
          <h1 className="mt-2 text-3xl font-bold">Pembayaran pendaftaran</h1>
        </div>
        <div className="p-6 sm:p-8">
          <dl className="grid gap-5 sm:grid-cols-2">
            <div><dt className="text-sm text-slate-500">Nama anak</dt><dd className="mt-1 font-bold text-emerald-950">{child.namaAnak}</dd></div>
            <div><dt className="text-sm text-slate-500">Jalur</dt><dd className="mt-1 font-bold text-emerald-950">{child.jalur?.nama}</dd></div>
            <div><dt className="text-sm text-slate-500">Kategori</dt><dd className="mt-1 font-bold text-emerald-950">{child.kategori?.nama}</dd></div>
            <div><dt className="text-sm text-slate-500">Asal TK</dt><dd className="mt-1 font-bold text-emerald-950">{subCategory}</dd></div>
          </dl>
          <div className="mt-7 rounded-2xl bg-emerald-50 p-5">
            <p className="text-sm font-semibold text-emerald-800">Total biaya pendaftaran</p>
            <p className="mt-1 text-3xl font-bold text-emerald-950">{rupiah(nominal)}</p>
            <p className="mt-2 text-xs leading-5 text-slate-600">Nominal diambil langsung oleh server dari matriks biaya aktif.</p>
          </div>
          {midtrans && urls ? (
            <SnapPaymentPanel
              childId={child.id}
              clientKey={midtrans.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
              snapScriptUrl={urls.snapScriptUrl}
              environment={urls.environment}
              initialStatus={payment?.status ?? null}
              initialSnapToken={
                payment?.status === StatusPembayaran.PENDING &&
                payment.metodePembayaran === MetodePembayaran.MIDTRANS
                  ? payment.midtransSnapToken
                  : null
              }
              localWebhookWarning={localWebhookWarning}
            />
          ) : (
            <ManualRegistrationPaymentPanel
              childId={child.id}
              bankAccounts={bankAccounts}
            />
          )}
        </div>
      </section>
    </div>
  );
}
