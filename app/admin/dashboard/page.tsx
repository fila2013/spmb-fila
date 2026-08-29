import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import { UserRole } from "@/generated/prisma/enums";
import { requireRolePage } from "@/lib/auth/navigation";
import { listBiayaMatrix, listJalur, listKategori } from "@/lib/master-data/service";

export const metadata: Metadata = { title: "Dashboard admin" };

export default async function AdminDashboardPage() {
  const admin = await requireRolePage(UserRole.ADMIN);
  const [jalur, kategori, matrix] = await Promise.all([
    listJalur(),
    listKategori(),
    listBiayaMatrix(),
  ]);
  const biayaKosong = matrix.filter((item) => !item.biaya?.statusAktif).length;
  return (
    <AdminShell activePath="/admin/dashboard" title="Dashboard SPMB" description="Ringkasan kesiapan master data sebelum pendaftaran calon murid dibuka." email={admin.email}>
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-950/10 bg-white p-5"><p className="text-sm text-slate-500">Jalur</p><p className="mt-2 text-3xl font-bold text-emerald-950">{jalur.length}</p><p className="mt-1 text-xs text-slate-500">{jalur.filter((item) => item.statusAktif).length} aktif</p></div>
        <div className="rounded-2xl border border-emerald-950/10 bg-white p-5"><p className="text-sm text-slate-500">Kategori</p><p className="mt-2 text-3xl font-bold text-emerald-950">{kategori.length}</p><p className="mt-1 text-xs text-slate-500">{kategori.filter((item) => item.statusAktif).length} aktif</p></div>
        <div className={`rounded-2xl border p-5 ${biayaKosong ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}><p className="text-sm text-slate-600">Matrix biaya belum aktif</p><p className="mt-2 text-3xl font-bold text-emerald-950">{biayaKosong}</p><p className="mt-1 text-xs text-slate-600">dari {matrix.length} kombinasi</p></div>
      </section>
    </AdminShell>
  );
}
