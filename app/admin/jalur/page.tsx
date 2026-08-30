import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import { ReprocessFallbackButton } from "@/components/admin/fallback-queue";
import { JalurForm } from "@/components/admin/master-data-forms";
import { UserRole } from "@/generated/prisma/enums";
import { requireRolePage } from "@/lib/auth/navigation";
import { listFallbackQueue } from "@/lib/fallback/service";
import { listJalur } from "@/lib/master-data/service";

export const metadata: Metadata = { title: "Kelola jalur" };

function dateValue(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? "";
}

export default async function JalurPage() {
  const admin = await requireRolePage(UserRole.ADMIN);
  const jalur = await listJalur();
  const queues = await Promise.all(jalur.map((item) => listFallbackQueue(item.id)));
  const queueByRoute = new Map(queues.map((item) => [item.route.id, item.queue]));
  const choices = jalur.map(({ id, nama }) => ({ id, nama }));

  return (
    <AdminShell activePath="/admin/jalur" title="Kelola jalur" description="Atur periode, status, kuota maksimum, fallback, dan kebijakan jika calon murid gagal." email={admin.email}>
      <section className="rounded-2xl border border-emerald-950/10 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-bold text-emerald-950">Tambah jalur</h2>
        <div className="mt-5 max-w-2xl"><JalurForm choices={choices} /></div>
      </section>

      <section className="mt-6 grid gap-4">
        {jalur.map((item) => {
          const queue = queueByRoute.get(item.id) ?? [];
          return (
          <article key={item.id} className="rounded-2xl border border-emerald-950/10 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="text-xl font-bold text-emerald-950">{item.nama}</h2><p className="mt-1 text-sm text-slate-600">Kuota {item.kuotaTerpakai} / {item.kuotaMaks ?? "tanpa batas"}</p></div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${item.statusAktif ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{item.statusAktif ? "Aktif" : "Nonaktif"}</span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-500">Periode</dt><dd className="font-semibold text-slate-800">{dateValue(item.periodeMulai) || "–"} s.d. {dateValue(item.periodeSelesai) || "–"}</dd></div>
              <div><dt className="text-slate-500">Jika gagal</dt><dd className="font-semibold text-slate-800">{item.fallbackJalur ? `Pindah ke ${item.fallbackJalur.nama}` : item.hapusDataJikaGagal ? "Hapus data setelah konfirmasi" : "Tidak ada aksi otomatis"}</dd></div>
            </dl>
            {queue.length ? <section className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-amber-950">Antrian fallback · {queue.length} peserta</h3><p className="mt-1 text-xs leading-5 text-amber-900">Urutan berdasarkan waktu pendaftaran paling awal.</p></div><ReprocessFallbackButton jalurId={item.id} /></div><ol className="mt-3 grid gap-2">{queue.map((candidate) => <li key={candidate.id} className="rounded-lg bg-white px-3 py-2 text-sm text-slate-800"><span className="font-bold">#{candidate.position} {candidate.namaAnak}</span><span className="block text-xs text-slate-500">{candidate.jalur?.nama ?? "Tanpa jalur asal"} · {candidate.kategori?.nama ?? "Tanpa kategori"} · {candidate.createdAt.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</span></li>)}</ol></section> : null}
            <details className="mt-5 border-t border-emerald-950/10 pt-4"><summary className="cursor-pointer text-sm font-bold text-emerald-800">Edit jalur</summary><div className="mt-5 max-w-2xl"><JalurForm choices={choices} value={{ id: item.id, nama: item.nama, statusAktif: item.statusAktif, periodeMulai: dateValue(item.periodeMulai), periodeSelesai: dateValue(item.periodeSelesai), kuotaMaks: item.kuotaMaks, kuotaTerpakai: item.kuotaTerpakai, fallbackJalurId: item.fallbackJalurId, hapusDataJikaGagal: item.hapusDataJikaGagal }} /></div></details>
          </article>
          );
        })}
      </section>
    </AdminShell>
  );
}
