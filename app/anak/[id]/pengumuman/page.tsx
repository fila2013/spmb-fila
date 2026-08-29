import type { Metadata } from "next";
import Link from "next/link";

import { AnnouncementBanner, StageContentBlocks } from "@/components/stages/stage-content";
import { requireWaliPage } from "@/lib/auth/navigation";
import { getAnnouncementForWali } from "@/lib/stages/service";

export const metadata: Metadata = { title: "Pengumuman SPMB" };

export default async function AnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  const wali = await requireWaliPage();
  const data = await getAnnouncementForWali((await params).id, wali.userId);
  return <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8"><Link href="/dashboard" className="text-sm font-bold text-emerald-800 hover:underline">← Dashboard</Link><p className="mt-8 text-sm font-bold uppercase tracking-[0.17em] text-amber-700">Pengumuman SPMB</p><h1 className="mt-2 text-3xl font-bold text-emerald-950">{data.child.namaAnak}</h1><p className="mt-2 text-slate-600">{data.child.jalur} · {data.child.kategori}</p><div className="mt-6"><AnnouncementBanner released={data.released} status={data.statusAkhir} tanggalRilis={data.tanggalRilis} /></div>{data.released ? <div className="mt-6"><StageContentBlocks content={data.content} /></div> : null}</main>;
}
