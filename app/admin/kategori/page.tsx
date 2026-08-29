import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import { KategoriForm } from "@/components/admin/master-data-forms";
import { UserRole } from "@/generated/prisma/enums";
import { requireRolePage } from "@/lib/auth/navigation";
import { listKategori } from "@/lib/master-data/service";

export const metadata: Metadata = { title: "Kelola kategori" };

function dateValue(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? "";
}

export default async function KategoriPage() {
  const admin = await requireRolePage(UserRole.ADMIN);
  const kategori = await listKategori();
  return (
    <AdminShell activePath="/admin/kategori" title="Kelola kategori" description="Atur kategori pendaftar, periode pendaftaran, status aktif, dan batas kuotanya." email={admin.email}>
      <section className="rounded-2xl border border-emerald-950/10 bg-white p-5 sm:p-6"><h2 className="text-lg font-bold text-emerald-950">Tambah kategori</h2><div className="mt-5 max-w-2xl"><KategoriForm /></div></section>
      <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">Pilihan TKIT Fitrah Insani 1 dan 2 untuk Alumni bersifat tetap dan bukan master data yang dapat diubah.</p>
      <section className="mt-4 grid gap-4">
        {kategori.map((item) => (
          <article key={item.id} className="rounded-2xl border border-emerald-950/10 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold text-emerald-950">{item.nama}</h2><p className="mt-1 text-sm text-slate-600">{item.tipe === "ALUMNI_TKFI" ? "Alumni TKIT" : "Eksternal / Umum"} · Kuota {item.kuotaTerpakai} / {item.kuotaMaks ?? "tanpa batas"}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${item.statusAktif ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{item.statusAktif ? "Aktif" : "Nonaktif"}</span></div>
            <p className="mt-3 text-sm text-slate-600">Periode: {dateValue(item.periodeMulai) || "–"} s.d. {dateValue(item.periodeSelesai) || "–"}</p>
            <details className="mt-5 border-t border-emerald-950/10 pt-4"><summary className="cursor-pointer text-sm font-bold text-emerald-800">Edit kategori</summary><div className="mt-5 max-w-2xl"><KategoriForm value={{ id: item.id, nama: item.nama, tipe: item.tipe, statusAktif: item.statusAktif, periodeMulai: dateValue(item.periodeMulai), periodeSelesai: dateValue(item.periodeSelesai), kuotaMaks: item.kuotaMaks, kuotaTerpakai: item.kuotaTerpakai }} /></div></details>
          </article>
        ))}
      </section>
    </AdminShell>
  );
}

