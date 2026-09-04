import type { Metadata } from "next";
import Link from "next/link";

import { StageContentBlocks } from "@/components/stages/stage-content";
import { requireWaliPage } from "@/lib/auth/navigation";
import { getAssessmentForWali } from "@/lib/stages/service";

export const metadata: Metadata = { title: "Informasi assessment" };

export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const wali = await requireWaliPage();
  const data = await getAssessmentForWali((await params).id, wali.userId);
  return <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8"><Link href="/dashboard" className="text-sm font-bold text-emerald-800 hover:underline">← Dashboard</Link><p className="mt-8 text-sm font-bold uppercase tracking-[0.17em] text-amber-700">Tahap assessment</p><h1 className="mt-2 text-3xl font-bold text-emerald-950">{data.child.namaAnak}</h1><p className="mt-2 text-slate-600">{data.child.jalur} · {data.child.kategori}</p><div className="mt-6 rounded-2xl bg-violet-50 p-4 text-sm text-violet-950"><span className="font-bold">Status kehadiran:</span> {data.assessment.status === "BELUM" ? "Belum dicatat" : data.assessment.status === "HADIR" ? "Hadir" : "Tidak hadir"}</div><div className="mt-6"><StageContentBlocks content={data.content} calendarContext={{ stageLabel: "Assessment", childName: data.child.namaAnak }} /></div></main>;
}
