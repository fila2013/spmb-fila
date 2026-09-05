import type { Metadata } from "next";
import Link from "next/link";

import { FinalRouteChoiceForm } from "@/components/stages/final-route-choice-form";
import {
  AnnouncementBanner,
  StageContentBlocks,
} from "@/components/stages/stage-content";
import { PilihanJalurFinal } from "@/generated/prisma/enums";
import { requireWaliPage } from "@/lib/auth/navigation";
import { getAnnouncementForWali } from "@/lib/stages/service";

export const metadata: Metadata = { title: "Pengumuman SPMB" };

export default async function AnnouncementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const wali = await requireWaliPage();
  const data = await getAnnouncementForWali((await params).id, wali.userId);
  const choice = data.finalRouteChoice;
  const displayedRoute =
    data.child.jalur ?? choice?.target?.nama ?? choice?.source?.nama;

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8">
      <Link
        href="/dashboard"
        className="text-sm font-bold text-emerald-800 hover:underline"
      >
        ← Dashboard
      </Link>
      <p className="mt-8 text-sm font-bold uppercase tracking-[0.17em] text-amber-700">
        Pengumuman SPMB
      </p>
      <h1 className="mt-2 text-3xl font-bold text-emerald-950">
        {data.child.namaAnak}
      </h1>
      <p className="mt-2 text-slate-600">
        {displayedRoute} · {data.child.kategori}
      </p>
      <div className="mt-6">
        <AnnouncementBanner
          released={data.released}
          status={data.statusAkhir}
          tanggalRilis={data.tanggalRilis}
          waitingQuota={data.waitingQuota}
          fallbackJalur={data.fallbackJalur}
        />
      </div>

      {choice?.required && choice.source && choice.target ? (
        <FinalRouteChoiceForm
          childId={data.child.id}
          sourceName={choice.source.nama}
          targetName={choice.target.nama}
        />
      ) : null}

      {choice?.selected && choice.source && choice.target ? (
        <section className="mt-6 rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sky-950">
          <p className="text-xs font-bold uppercase tracking-[0.15em]">
            Pilihan jalur final
          </p>
          <h2 className="mt-2 text-xl font-bold">
            {choice.selected === PilihanJalurFinal.TETAP_JALUR_ASAL
              ? `Tetap melanjutkan ${choice.source.nama}`
              : `Memilih ${choice.target.nama}`}
          </h2>
          <p className="mt-2 text-sm leading-6">
            {data.waitingQuota
              ? `Kuota ${choice.source.nama} telah dilepas. Pendaftaran menunggu penambahan kuota ${choice.target.nama}.`
              : "Pilihan sudah final dan tercatat pada data pendaftaran."}
          </p>
          {!data.waitingQuota ? (
            <Link
              href={`/anak/${data.child.id}/daftar-ulang`}
              className="mt-4 inline-flex rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800"
            >
              Lanjut ke daftar ulang
            </Link>
          ) : null}
        </section>
      ) : null}

      {data.released ? (
        <div className="mt-6">
          <StageContentBlocks
            content={data.content}
            calendarContext={{
              stageLabel: "Pengumuman",
              childName: data.child.namaAnak,
            }}
          />
        </div>
      ) : null}
    </main>
  );
}
