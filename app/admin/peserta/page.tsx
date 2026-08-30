import type { Metadata } from "next";
import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { UserRole } from "@/generated/prisma/enums";
import { requireRolePage } from "@/lib/auth/navigation";
import { statusPresentation } from "@/lib/calon-murid/presentation";
import { listParticipants } from "@/lib/stages/service";

export const metadata: Metadata = { title: "Peserta SPMB" };

export default async function ParticipantsPage({ searchParams }: { searchParams: Promise<{ q?: string; deleted?: string }> }) {
  const admin = await requireRolePage(UserRole.ADMIN);
  const filters = await searchParams;
  const query = filters.q?.trim().slice(0, 100) ?? "";
  const participants = await listParticipants(query);
  return <AdminShell activePath="/admin/peserta" title="Peserta" description="Kelola assessment, pengumuman, pembayaran DU, dan status undangan WhatsApp setiap calon murid." email={admin.email}>
    {filters.deleted === "1" ? <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">Data pribadi calon murid telah dihapus. Akun wali, anak lain, jejak pembayaran, dan snapshot audit tetap tersimpan.</p> : null}
    <form className="mb-5 flex gap-2"><input name="q" defaultValue={query} placeholder="Cari nama anak atau email wali" className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5" /><button className="rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-bold text-white">Cari</button></form>
    <section className="overflow-hidden rounded-2xl border border-emerald-950/10 bg-white"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-emerald-950 text-white"><tr><th className="px-4 py-3">Peserta</th><th className="px-4 py-3">Jalur / kategori</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Aksi</th></tr></thead><tbody className="divide-y divide-slate-100">{participants.map((item) => { const status = statusPresentation[item.statusKeseluruhan]; return <tr key={item.id}><td className="px-4 py-3"><p className="font-semibold text-slate-900">{item.namaAnak}</p><p className="text-xs text-slate-500">{item.user.email}</p></td><td className="px-4 py-3 text-slate-700">{item.jalur?.nama ?? "—"} / {item.kategori?.nama ?? "—"}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${status.className}`}>{status.label}</span></td><td className="px-4 py-3"><Link href={`/admin/peserta/${item.id}`} className="font-bold text-emerald-800 hover:underline">Kelola</Link></td></tr>; })}</tbody></table></div>{participants.length === 0 ? <p className="p-6 text-center text-sm text-slate-600">Peserta tidak ditemukan.</p> : null}</section>
  </AdminShell>;
}
