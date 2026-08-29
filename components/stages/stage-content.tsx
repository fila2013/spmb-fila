import type { StatusPengumuman } from "@/generated/prisma/enums";

/* eslint-disable @next/next/no-img-element -- CMS URLs are runtime-configured Supabase Storage assets. */

export type PublicStageContent = { id: string; judul: string; tanggal: string | null; isiTeks: string | null; gambarUrl: string | null; urutanLayout: number };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}

export function StageContentBlocks({ content }: { content: PublicStageContent[] }) {
  if (!content.length) return <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm text-slate-600">Informasi untuk tahap ini belum diterbitkan admin.</div>;
  return <div className="grid gap-5">{content.map((item) => <article key={item.id} className="overflow-hidden rounded-2xl border border-emerald-950/10 bg-white shadow-sm">{item.gambarUrl ? <img src={item.gambarUrl} alt="" className="max-h-96 w-full object-cover" /> : null}<div className="p-5 sm:p-6">{item.tanggal ? <p className="text-sm font-bold text-amber-700">{formatDate(item.tanggal)}</p> : null}<h2 className="mt-1 text-xl font-bold text-emerald-950">{item.judul}</h2>{item.isiTeks ? <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-700">{item.isiTeks}</p> : null}</div></article>)}</div>;
}

export function AnnouncementBanner({ released, status, tanggalRilis }: { released: boolean; status: StatusPengumuman | null; tanggalRilis: string | null }) {
  if (!released) return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950"><h2 className="font-bold">Pengumuman belum dirilis</h2><p className="mt-1 text-sm leading-6">{tanggalRilis ? `Hasil dijadwalkan dapat dilihat pada ${formatDate(tanggalRilis)}.` : "Tanggal rilis belum ditentukan admin."}</p></div>;
  const accepted = status === "DITERIMA";
  return <div className={`rounded-2xl border p-6 ${accepted ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-red-200 bg-red-50 text-red-950"}`}><p className="text-xs font-bold uppercase tracking-[0.16em]">Hasil seleksi</p><h2 className="mt-2 text-3xl font-bold">{accepted ? "Diterima" : "Tidak diterima"}</h2></div>;
}
