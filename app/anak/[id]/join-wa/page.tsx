import type { Metadata } from "next";
import Link from "next/link";

import { WhatsappJoinPanel } from "@/components/admission/whatsapp-join-panel";
import { StageContentBlocks } from "@/components/stages/stage-content";
import { getJoinWaPageData } from "@/lib/admission/service";
import { requireWaliPage } from "@/lib/auth/navigation";

export const metadata: Metadata = { title: "Join WhatsApp" };

export default async function JoinWaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const wali = await requireWaliPage();
  const data = await getJoinWaPageData((await params).id, wali.userId);
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8">
      <Link href="/dashboard" className="text-sm font-bold text-emerald-800 hover:underline">← Dashboard</Link>
      <p className="mt-8 text-sm font-bold uppercase tracking-[0.17em] text-amber-700">Join With Us</p>
      <h1 className="mt-2 text-3xl font-bold text-emerald-950">Grup WhatsApp · {data.child.namaAnak}</h1>
      <p className="mt-2 text-slate-600">{data.child.jalur} · {data.child.kategori}</p>
      <div className="mt-6">
        <WhatsappJoinPanel
          childId={data.child.id}
          status={data.status}
          hasInviteLink={data.hasInviteLink}
          linkWasOpened={Boolean(data.linkOpenedAt)}
          confirmedAt={data.confirmedAt}
        />
      </div>
      <div className="mt-6"><StageContentBlocks content={data.content} /></div>
    </main>
  );
}
