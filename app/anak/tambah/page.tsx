import type { Metadata } from "next";
import Link from "next/link";

import { AddChildForm } from "@/components/calon-murid/enrollment-forms";
import { requireWaliPage } from "@/lib/auth/navigation";
import { availabilityLabel } from "@/lib/calon-murid/rules";
import { listSelectableJalur } from "@/lib/calon-murid/service";

export const metadata: Metadata = { title: "Tambah calon murid" };

function quotaLabel(max: number | null, used: number) {
  return max === null ? "Tanpa batas kuota" : `${Math.max(max - used, 0)} kursi tersisa`;
}

export default async function AddChildPage() {
  await requireWaliPage();
  const routes = (await listSelectableJalur()).map((route) => ({
    id: route.id,
    nama: route.nama,
    available: route.availability.available,
    availabilityLabel: availabilityLabel(route.availability),
    quotaLabel: quotaLabel(route.kuotaMaks, route.kuotaTerpakai),
  }));

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-12">
      <Link href="/dashboard" className="text-sm font-semibold text-emerald-800 hover:underline">← Kembali ke Anak Saya</Link>
      <div className="mt-6 rounded-3xl border border-emerald-950/10 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.17em] text-amber-700">Langkah 1 dari 2</p>
        <h1 className="mt-2 text-3xl font-bold text-emerald-950">Tambah anak dan pilih jalur</h1>
        <p className="mt-3 leading-7 text-slate-600">Kuota diamankan secara atomik saat formulir berhasil disimpan.</p>
        <div className="mt-7"><AddChildForm routes={routes} /></div>
      </div>
    </div>
  );
}
