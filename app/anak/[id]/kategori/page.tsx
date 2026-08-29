import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SelectCategoryForm } from "@/components/calon-murid/enrollment-forms";
import { StatusKeseluruhan } from "@/generated/prisma/enums";
import { AuthorizationError } from "@/lib/auth/errors";
import { requireWaliPage } from "@/lib/auth/navigation";
import { CalonMuridError } from "@/lib/calon-murid/errors";
import { availabilityLabel } from "@/lib/calon-murid/rules";
import { getOwnedCalonMurid, listSelectableKategori } from "@/lib/calon-murid/service";

export const metadata: Metadata = { title: "Pilih kategori pendaftar" };

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

export default async function SelectCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireWaliPage();
  const { id } = await params;
  let child;
  try {
    child = await getOwnedCalonMurid(id, user.userId);
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof CalonMuridError) notFound();
    throw error;
  }

  if (child.statusKeseluruhan === StatusKeseluruhan.MENUNGGU_VERIFIKASI_BAYAR) redirect(`/anak/${child.id}/pembayaran-pendaftaran`);
  if (child.statusKeseluruhan !== StatusKeseluruhan.PILIH_JALUR || !child.jalurId) redirect("/dashboard");

  const categories = (await listSelectableKategori(child.jalurId)).map((category) => ({
    id: category.id,
    nama: category.nama,
    tipe: category.tipe,
    available: category.availability.available,
    availabilityLabel: availabilityLabel(category.availability),
    quotaLabel: category.kuotaMaks === null ? "Tanpa batas kuota" : `${Math.max(category.kuotaMaks - category.kuotaTerpakai, 0)} kursi tersisa`,
    feeConfigured: Boolean(category.fee),
    feeLabel: category.fee ? rupiah(category.fee.nominal) : null,
  }));

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-12">
      <Link href="/dashboard" className="text-sm font-semibold text-emerald-800 hover:underline">← Kembali ke Anak Saya</Link>
      <div className="mt-6 rounded-3xl border border-emerald-950/10 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.17em] text-amber-700">Langkah 2 dari 2</p>
        <h1 className="mt-2 text-3xl font-bold text-emerald-950">Pilih kategori {child.namaAnak}</h1>
        <p className="mt-3 leading-7 text-slate-600">Jalur <strong>{child.jalur?.nama}</strong>. Nominal ditentukan dari matriks biaya resmi dan tidak dapat diisi manual.</p>
        <div className="mt-7"><SelectCategoryForm childId={child.id} categories={categories} /></div>
      </div>
    </div>
  );
}
