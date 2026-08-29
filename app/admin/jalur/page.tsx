import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import { JalurForm } from "@/components/admin/master-data-forms";
import { UserRole } from "@/generated/prisma/enums";
import { requireRolePage } from "@/lib/auth/navigation";
import { listJalur } from "@/lib/master-data/service";

export const metadata: Metadata = { title: "Kelola jalur" };

function dateValue(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? "";
}

export default async function JalurPage() {
  const admin = await requireRolePage(UserRole.ADMIN);
  const jalur = await listJalur();
  const choices = jalur.map(({ id, nama }) => ({ id, nama }));

  return (
    <AdminShell activePath="/admin/jalur" title="Kelola jalur" description="Atur periode, status, kuota maksimum, fallback, dan kebijakan jika calon murid gagal." email={admin.email}>
      <section className="rounded-2xl border border-emerald-950/10 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-bold text-emerald-950">Tambah jalur</h2>
        <div className="mt-5 max-w-2xl"><JalurForm choices={choices} /></div>
      </section>

      <section className="mt-6 grid gap-4">
        {jalur.map((item) => (
          <article key={item.id} className="rounded-2xl border border-emerald-950/10 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="text-xl font-bold text-emerald-950">{item.nama}</h2><p className="mt-1 text-sm text-slate-600">Kuota {item.kuotaTerpakai} / {item.kuotaMaks ?? "tanpa batas"}</p></div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${item.statusAktif ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{item.statusAktif ? "Aktif" : "Nonaktif"}</span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-500">Periode</dt><dd className="font-semibold text-slate-800">{dateValue(item.periodeMulai) || "–"} s.d. {dateValue(item.periodeSelesai) || "–"}</dd></div>
              <div><dt className="text-slate-500">Jika gagal</dt><dd className="font-semibold text-slate-800">{item.fallbackJalur ? `Pindah ke ${item.fallbackJalur.nama}` : item.hapusDataJikaGagal ? "Hapus data setelah konfirmasi" : "Tidak ada aksi otomatis"}</dd></div>
            </dl>
            <details className="mt-5 border-t border-emerald-950/10 pt-4"><summary className="cursor-pointer text-sm font-bold text-emerald-800">Edit jalur</summary><div className="mt-5 max-w-2xl"><JalurForm choices={choices} value={{ id: item.id, nama: item.nama, statusAktif: item.statusAktif, periodeMulai: dateValue(item.periodeMulai), periodeSelesai: dateValue(item.periodeSelesai), kuotaMaks: item.kuotaMaks, kuotaTerpakai: item.kuotaTerpakai, fallbackJalurId: item.fallbackJalurId, hapusDataJikaGagal: item.hapusDataJikaGagal }} /></div></details>
          </article>
        ))}
      </section>
    </AdminShell>
  );
}

