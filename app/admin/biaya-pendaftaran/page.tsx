import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import { BiayaForm } from "@/components/admin/master-data-forms";
import { UserRole } from "@/generated/prisma/enums";
import { requireRolePage } from "@/lib/auth/navigation";
import { listBiayaMatrix } from "@/lib/master-data/service";

export const metadata: Metadata = { title: "Biaya pendaftaran" };

const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export default async function BiayaPendaftaranPage() {
  const admin = await requireRolePage(UserRole.ADMIN);
  const matrix = await listBiayaMatrix();
  return (
    <AdminShell activePath="/admin/biaya-pendaftaran" title="Matrix biaya pendaftaran" description="Tetapkan nominal server-side untuk setiap kombinasi Jalur × Kategori. Kombinasi kosong atau nonaktif akan memblokir transaksi." email={admin.email}>
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">Nominal dari halaman ini menjadi satu-satunya sumber biaya pendaftaran. Wali murid tidak pernah mengirim nominal.</div>
      <section className="mt-5 grid gap-4">
        {matrix.map(({ jalur, kategori, biaya }) => (
          <article key={`${jalur.id}:${kategori.id}`} className="rounded-2xl border border-emerald-950/10 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold text-emerald-950">{jalur.nama} × {kategori.nama}</h2><p className="mt-1 text-sm text-slate-600">{biaya ? rupiah.format(biaya.nominal) : "Nominal belum diatur"}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${biaya?.statusAktif ? "bg-emerald-100 text-emerald-800" : "bg-red-50 text-red-700"}`}>{biaya ? biaya.statusAktif ? "Aktif" : "Nonaktif" : "Kosong"}</span></div>
            <details className="mt-4 border-t border-emerald-950/10 pt-4" open={!biaya}><summary className="cursor-pointer text-sm font-bold text-emerald-800">{biaya ? "Edit biaya" : "Atur nominal"}</summary><div className="mt-4 max-w-xl"><BiayaForm id={biaya?.id} jalurId={jalur.id} kategoriId={kategori.id} nominal={biaya?.nominal} statusAktif={biaya?.statusAktif} /></div></details>
          </article>
        ))}
      </section>
    </AdminShell>
  );
}

