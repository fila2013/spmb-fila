import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import {
  StatusAssessment,
  StatusKeseluruhan,
  StatusPembayaran,
  StatusPengumuman,
  StatusUndanganWa,
  UserRole,
} from "@/generated/prisma/enums";
import { requireRolePage } from "@/lib/auth/navigation";
import { statusPresentation } from "@/lib/calon-murid/presentation";
import { listJalur, listKategori } from "@/lib/master-data/service";
import {
  announcementLabels,
  assessmentLabels,
  paymentLabels,
  whatsappLabels,
} from "@/lib/reporting/labels";
import { reportingFilterSchema, pageSearchParamsRecord } from "@/lib/reporting/schemas";
import { listReportParticipants } from "@/lib/reporting/service";

export const metadata: Metadata = { title: "Laporan peserta" };

type SearchParams = Record<string, string | string[] | undefined>;

function exportHref(filters: Record<string, unknown>, format: "csv" | "xlsx") {
  const params = new URLSearchParams({ format });
  for (const [key, value] of Object.entries(filters)) {
    if (typeof value === "string" && value) params.set(key, value);
  }
  return `/api/admin/laporan/export?${params.toString()}`;
}

function FilterSelect({ name, label, defaultValue, children }: { name: string; label: string; defaultValue?: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-semibold text-slate-700"><span>{label}</span><select name={name} defaultValue={defaultValue ?? ""} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-900"><option value="">Semua</option>{children}</select></label>;
}

export default async function ReportingPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await requireRolePage(UserRole.ADMIN);
  const rawFilters = pageSearchParamsRecord(await searchParams);
  const parsed = reportingFilterSchema.safeParse(rawFilters);
  const filters = parsed.success ? parsed.data : {};
  const [jalur, kategori, participants] = await Promise.all([
    listJalur(),
    listKategori(),
    listReportParticipants(filters),
  ]);
  const preview = participants.slice(0, 100);

  return <AdminShell activePath="/admin/laporan" title="Laporan peserta" description="Saring rekap operasional peserta, lalu unduh hasil yang sama sebagai Excel atau CSV." email={admin.email}>
    {!parsed.success ? <p className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">Sebagian filter tidak valid dan telah diabaikan.</p> : null}
    <form className="rounded-2xl border border-emerald-950/10 bg-white p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700 sm:col-span-2 xl:col-span-3"><span>Cari peserta</span><input name="q" defaultValue={filters.q ?? ""} placeholder="Nama calon murid atau email wali" className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-900" /></label>
        <FilterSelect name="jalurId" label="Jalur" defaultValue={filters.jalurId}>{jalur.map((item) => <option key={item.id} value={item.id}>{item.nama}</option>)}</FilterSelect>
        <FilterSelect name="kategoriId" label="Kategori" defaultValue={filters.kategoriId}>{kategori.map((item) => <option key={item.id} value={item.id}>{item.nama}</option>)}</FilterSelect>
        <FilterSelect name="statusKeseluruhan" label="Tahap keseluruhan" defaultValue={filters.statusKeseluruhan}>{Object.values(StatusKeseluruhan).map((status) => <option key={status} value={status}>{statusPresentation[status].label}</option>)}</FilterSelect>
        <FilterSelect name="statusPembayaran" label="Pembayaran pendaftaran" defaultValue={filters.statusPembayaran}><option value="BELUM_ADA">Belum ada</option>{Object.values(StatusPembayaran).map((status) => <option key={status} value={status}>{paymentLabels[status]}</option>)}</FilterSelect>
        <FilterSelect name="statusEnrollment" label="Enrollment" defaultValue={filters.statusEnrollment}><option value="BELUM_LENGKAP">Belum lengkap</option><option value="LENGKAP">Lengkap</option></FilterSelect>
        <FilterSelect name="statusAssessment" label="Assessment" defaultValue={filters.statusAssessment}>{Object.values(StatusAssessment).map((status) => <option key={status} value={status}>{assessmentLabels[status]}</option>)}</FilterSelect>
        <FilterSelect name="statusKelulusan" label="Hasil pengumuman" defaultValue={filters.statusKelulusan}><option value="MENUNGGU">Menunggu</option>{Object.values(StatusPengumuman).map((status) => <option key={status} value={status}>{announcementLabels[status]}</option>)}</FilterSelect>
        <FilterSelect name="statusDu" label="Pembayaran daftar ulang" defaultValue={filters.statusDu}><option value="BELUM_ADA">Belum ada</option>{Object.values(StatusPembayaran).map((status) => <option key={status} value={status}>{paymentLabels[status]}</option>)}</FilterSelect>
        <FilterSelect name="statusWa" label="Grup WhatsApp" defaultValue={filters.statusWa}><option value="BELUM_ADA">Belum ada</option>{Object.values(StatusUndanganWa).map((status) => <option key={status} value={status}>{whatsappLabels[status]}</option>)}</FilterSelect>
      </div>
      <div className="mt-5 flex flex-wrap gap-3"><button className="rounded-xl bg-emerald-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800">Terapkan filter</button><a href="/admin/laporan" className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">Reset</a></div>
    </form>

    <section className="mt-6 rounded-2xl border border-emerald-950/10 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-xl font-bold text-emerald-950">Hasil laporan</h2><p className="mt-1 text-sm text-slate-600">{participants.length} peserta sesuai filter{participants.length > 100 ? "; pratinjau menampilkan 100 baris pertama" : ""}.</p></div><div className="flex flex-wrap gap-2"><a href={exportHref(filters, "xlsx")} className="rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-bold text-white">Unduh Excel</a><a href={exportHref(filters, "csv")} className="rounded-xl border border-emerald-800 px-4 py-2.5 text-sm font-bold text-emerald-900">Unduh CSV</a></div></div>
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-emerald-950 text-white"><tr><th className="px-4 py-3">Peserta</th><th className="px-4 py-3">Jalur / kategori</th><th className="px-4 py-3">Tahap</th><th className="px-4 py-3">Assessment</th><th className="px-4 py-3">Pengumuman</th><th className="px-4 py-3">WhatsApp</th></tr></thead><tbody className="divide-y divide-slate-100">{preview.map((item) => <tr key={item.id}><td className="px-4 py-3"><p className="font-semibold text-slate-900">{item.namaAnak}</p><p className="text-xs text-slate-500">{item.user.email}</p></td><td className="px-4 py-3">{item.jalur?.nama ?? "—"} / {item.kategori?.nama ?? "—"}</td><td className="px-4 py-3">{statusPresentation[item.statusKeseluruhan].label}</td><td className="px-4 py-3">{assessmentLabels[item.hasilAssessment?.status ?? StatusAssessment.BELUM]}</td><td className="px-4 py-3">{item.pengumuman?.statusAkhir ? announcementLabels[item.pengumuman.statusAkhir] : "Menunggu"}</td><td className="px-4 py-3">{item.statusGrupWa ? whatsappLabels[item.statusGrupWa.status] : "Belum ada"}</td></tr>)}</tbody></table>{participants.length === 0 ? <p className="py-8 text-center text-sm text-slate-600">Tidak ada peserta yang cocok dengan filter.</p> : null}</div>
    </section>
  </AdminShell>;
}
