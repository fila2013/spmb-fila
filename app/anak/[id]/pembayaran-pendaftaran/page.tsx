import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AuthorizationError } from "@/lib/auth/errors";
import { requireWaliPage } from "@/lib/auth/navigation";
import { CalonMuridError } from "@/lib/calon-murid/errors";
import { getPaymentPreparation } from "@/lib/calon-murid/service";

export const metadata: Metadata = { title: "Pembayaran pendaftaran" };

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

export default async function PaymentPreparationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireWaliPage();
  const { id } = await params;
  let summary;
  try {
    summary = await getPaymentPreparation(id, user.userId);
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof CalonMuridError) notFound();
    throw error;
  }

  const { child, fee } = summary;
  const subCategory = child.subKategoriEnum
    ? child.subKategoriEnum === "TKIT_FI_1" ? "TKIT Fitrah Insani 1" : "TKIT Fitrah Insani 2"
    : child.subKategoriText;

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-12">
      <Link href="/dashboard" className="text-sm font-semibold text-emerald-800 hover:underline">← Kembali ke Anak Saya</Link>
      <section className="mt-6 overflow-hidden rounded-3xl border border-emerald-950/10 bg-white shadow-sm">
        <div className="bg-emerald-950 px-6 py-7 text-white sm:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.17em] text-amber-300">Ringkasan pendaftaran</p>
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
            <p className="mt-1 text-3xl font-bold text-emerald-950">{rupiah(fee.nominal)}</p>
            <p className="mt-2 text-xs leading-5 text-slate-600">Nominal diambil langsung dari matriks biaya aktif.</p>
          </div>
          <button disabled className="mt-6 w-full cursor-not-allowed rounded-xl bg-slate-300 px-5 py-3.5 text-sm font-bold text-slate-600">Pembayaran Midtrans tersedia pada Phase 5</button>
        </div>
      </section>
    </div>
  );
}
