import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { StageContentForm } from "@/components/admin/stage-forms";
import { TahapKonten, UserRole } from "@/generated/prisma/enums";
import { requireRolePage } from "@/lib/auth/navigation";
import { listJalur, listKategori } from "@/lib/master-data/service";
import { dateOnly } from "@/lib/stages/rules";
import { listStageContent } from "@/lib/stages/service";

export const metadata: Metadata = { title: "Konten tahap" };

export default async function StageContentPage({ params }: { params: Promise<{ tahap: string }> }) {
  const admin = await requireRolePage(UserRole.ADMIN);
  const slug = (await params).tahap;
  const tahap = slug === "assessment" ? TahapKonten.ASSESSMENT : slug === "announcement" ? TahapKonten.ANNOUNCEMENT : null;
  if (!tahap) notFound();
  const [content, jalur, kategori] = await Promise.all([listStageContent(tahap), listJalur(), listKategori()]);
  const label = tahap === TahapKonten.ASSESSMENT ? "Assessment" : "Announcement";
  const choicesJalur = jalur.map(({ id, nama }) => ({ id, nama }));
  const choicesKategori = kategori.map(({ id, nama }) => ({ id, nama }));
  return <AdminShell activePath={`/admin/konten/${slug}`} title={`Konten ${label}`} description={`Atur blok informasi ${label.toLowerCase()} berdasarkan jalur dan kategori. Konten ditampilkan sebagai teks aman, bukan HTML.`} email={admin.email}>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="grid gap-4"><h2 className="text-lg font-bold text-emerald-950">Konten tersimpan</h2>{content.length ? content.map((item) => <details key={item.id} className="rounded-2xl border border-emerald-950/10 bg-white p-5"><summary className="cursor-pointer font-bold text-emerald-950">{item.judul} <span className="ml-2 text-xs font-normal text-slate-500">{item.statusAktif ? "Aktif" : "Nonaktif"} · {item.jalur?.nama ?? "Semua jalur"} · {item.kategori?.nama ?? "Semua kategori"}</span></summary><div className="mt-5"><StageContentForm tahap={tahap} jalur={choicesJalur} kategori={choicesKategori} value={{ id: item.id, judul: item.judul, tanggal: dateOnly(item.tanggal) ?? "", isiTeks: item.isiTeks ?? "", gambarUrl: item.gambarUrl ?? "", urutanLayout: item.urutanLayout, statusAktif: item.statusAktif, jalurId: item.jalurId ?? "", kategoriId: item.kategoriId ?? "" }} /></div></details>) : <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">Belum ada konten {label.toLowerCase()}.</p>}</section>
      <aside className="h-fit rounded-2xl border border-emerald-950/10 bg-white p-5 xl:sticky xl:top-6"><h2 className="mb-4 text-lg font-bold text-emerald-950">Tambah blok</h2><StageContentForm tahap={tahap} jalur={choicesJalur} kategori={choicesKategori} /></aside>
    </div>
  </AdminShell>;
}
