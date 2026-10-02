import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { BirthDetailsForm, SelectCategoryForm } from "@/components/calon-murid/enrollment-forms";
import { StatusKeseluruhan, TipeInput } from "@/generated/prisma/enums";
import { AuthorizationError } from "@/lib/auth/errors";
import { requireWaliPage } from "@/lib/auth/navigation";
import { CalonMuridError } from "@/lib/calon-murid/errors";
import { availabilityLabel } from "@/lib/calon-murid/rules";
import { getOwnedCalonMurid, getRegistrationAgeRule, listSelectableKategori } from "@/lib/calon-murid/service";
import { fieldValueError } from "@/lib/enrollment/rules";
import { getRegistrationQuotaHold } from "@/lib/quota-hold/service";
import { isActivePendingHold, remainingQuota } from "@/lib/quota-hold/rules";

export const metadata: Metadata = { title: "Pilih kategori pendaftar" };

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

export default async function SelectCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hold?: string }>;
}) {
  const user = await requireWaliPage();
  const { id } = await params;
  let child;
  try {
    child = await getOwnedCalonMurid(id, user.userId);
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof CalonMuridError) notFound();
    throw error;
  }

  const [hold, ageRule] = await Promise.all([getRegistrationQuotaHold(child.id), getRegistrationAgeRule()]);
  const birthError = child.tanggalLahir
    ? fieldValueError({ id: "tanggalLahir", tipeInput: TipeInput.DATE, wajib: true, validasi: null, ...(ageRule ?? {}) }, child.tanggalLahir.toISOString().slice(0, 10), true)
    : "Tanggal lahir wajib diisi.";
  const requiresBirthUpdate = !ageRule || !child.tempatLahir || Boolean(birthError);
  if (
    child.statusKeseluruhan ===
      StatusKeseluruhan.MENUNGGU_VERIFIKASI_BAYAR &&
    isActivePendingHold(hold) && !requiresBirthUpdate
  ) {
    redirect(`/anak/${child.id}/pembayaran-pendaftaran`);
  }
  if (
    (child.statusKeseluruhan !== StatusKeseluruhan.PILIH_JALUR &&
      child.statusKeseluruhan !==
        StatusKeseluruhan.MENUNGGU_VERIFIKASI_BAYAR) ||
    !child.jalurId
  ) {
    redirect("/dashboard");
  }
  const query = await searchParams;

  const selectableCategories = await listSelectableKategori(child.jalurId);
  const categories = selectableCategories.map((category) => ({
    id: category.id,
    nama: category.nama,
    tipe: category.tipe,
    available: category.availability.available,
    availabilityLabel: availabilityLabel(category.availability),
    quotaLabel: category.kuotaMaks === null ? "Tanpa batas kuota" : `${remainingQuota(category)} kursi tersisa`,
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
        {query.hold === "expired" ? (
          <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            Hold pembayaran sebelumnya telah berakhir. Pilih kategori dan lanjutkan kembali untuk mencoba memperoleh kuota baru.
          </p>
        ) : null}
        {requiresBirthUpdate ? (
          <div className="mt-7"><BirthDetailsForm childId={child.id} tempatLahir={child.tempatLahir} tanggalLahir={child.tanggalLahir?.toISOString().slice(0, 10) ?? null} ageRule={ageRule} /></div>
        ) : <>
          <details className="mt-6"><summary className="cursor-pointer text-sm font-semibold text-emerald-800">Lihat atau koreksi tempat dan tanggal lahir sebelum pembayaran</summary>
            <div className="mt-3"><BirthDetailsForm childId={child.id} tempatLahir={child.tempatLahir} tanggalLahir={child.tanggalLahir?.toISOString().slice(0, 10) ?? null} ageRule={ageRule} /></div>
          </details>
          <div className="mt-7"><SelectCategoryForm childId={child.id} categories={categories} /></div>
        </>}
      </div>
    </div>
  );
}
