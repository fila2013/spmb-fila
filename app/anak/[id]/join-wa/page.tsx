import type { Metadata } from "next";
import Link from "next/link";

import { StageContentBlocks } from "@/components/stages/stage-content";
import { StatusUndanganWa } from "@/generated/prisma/enums";
import { getJoinWaPageData } from "@/lib/admission/service";
import { requireWaliPage } from "@/lib/auth/navigation";

export const metadata: Metadata = { title: "Join WhatsApp" };

export default async function JoinWaPage({ params }: { params: Promise<{ id: string }> }) {
  const wali = await requireWaliPage();
  const data = await getJoinWaPageData((await params).id, wali.userId);
  const invited = data.status === StatusUndanganWa.SUDAH_DIUNDANG;
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8">
      <Link href="/dashboard" className="text-sm font-bold text-emerald-800 hover:underline">← Dashboard</Link>
      <p className="mt-8 text-sm font-bold uppercase tracking-[0.17em] text-amber-700">Join With Us</p>
      <h1 className="mt-2 text-3xl font-bold text-emerald-950">Grup WhatsApp · {data.child.namaAnak}</h1>
      <p className="mt-2 text-slate-600">{data.child.jalur} · {data.child.kategori}</p>
      <div className={`mt-6 rounded-2xl border p-5 ${invited ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
        <h2 className="font-bold">{invited ? "Sudah diundang" : "Menunggu diundang"}</h2>
        <p className="mt-1 text-sm leading-6">{invited ? "Panitia telah menandai peserta sebagai sudah diundang ke grup WhatsApp murid baru." : "Panitia akan mengundang secara manual. Tidak ada pesan atau undangan otomatis dari sistem."}</p>
      </div>
      <div className="mt-6"><StageContentBlocks content={data.content} /></div>
    </main>
  );
}
