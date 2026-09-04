import type { StatusPengumuman } from "@/generated/prisma/enums";
import { googleCalendarReminderUrl } from "@/lib/stages/rules";

/* eslint-disable @next/next/no-img-element -- CMS URLs are runtime-configured Supabase Storage assets. */

export type PublicStageContent = {
  id: string;
  judul: string;
  tanggal: string | null;
  isiTeks: string | null;
  gambarUrl: string | null;
  youtubeVideoId: string | null;
  urutanLayout: number;
};

type CalendarContext = {
  stageLabel: "Assessment" | "Pengumuman";
  childName: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function youtubeEmbedUrl(videoId: string) {
  const params = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    playsinline: "1",
    rel: "0",
  });
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

export function StageContentBlocks({
  content,
  calendarContext,
}: {
  content: PublicStageContent[];
  calendarContext?: CalendarContext;
}) {
  if (!content.length) {
    return <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm text-slate-600">Informasi untuk tahap ini belum diterbitkan admin.</div>;
  }

  return <div className="grid gap-5">{content.map((item) => {
    const calendarUrl = item.tanggal && calendarContext
      ? googleCalendarReminderUrl({
        title: `${calendarContext.stageLabel} SPMB — ${calendarContext.childName}: ${item.judul}`,
        date: item.tanggal,
        details: item.isiTeks,
      })
      : null;

    return <article key={item.id} className="overflow-hidden rounded-2xl border border-emerald-950/10 bg-white shadow-sm">
      {item.gambarUrl ? <img src={item.gambarUrl} alt={`Informasi ${item.judul}`} className="max-h-96 w-full object-cover" /> : null}
      <div className="p-5 sm:p-6">
        {item.tanggal ? <p className="text-sm font-bold text-amber-700">{formatDate(item.tanggal)}</p> : null}
        <h2 className="mt-1 text-xl font-bold text-emerald-950">{item.judul}</h2>
        {item.youtubeVideoId ? <div className="mt-4 aspect-video overflow-hidden rounded-xl bg-slate-950"><iframe src={youtubeEmbedUrl(item.youtubeVideoId)} title={item.judul} loading="lazy" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen className="h-full w-full border-0" /></div> : null}
        {item.isiTeks ? <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-700">{item.isiTeks}</p> : null}
        {calendarUrl ? <a href={calendarUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex rounded-xl border border-emerald-800/20 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-900 hover:bg-emerald-100">Tambahkan ke Google Calendar</a> : null}
      </div>
    </article>;
  })}</div>;
}

export function AnnouncementBanner({ released, status, tanggalRilis, waitingQuota, fallbackJalur }: { released: boolean; status: StatusPengumuman | null; tanggalRilis: string | null; waitingQuota: boolean; fallbackJalur: string | null }) {
  if (waitingQuota) return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950"><h2 className="font-bold">Menunggu Kuota</h2><p className="mt-1 text-sm leading-6">Pendaftaran sedang menunggu ketersediaan kuota{fallbackJalur ? ` di jalur ${fallbackJalur}` : " pada jalur lanjutan"}. Panitia akan memperbarui status sesuai urutan pendaftaran.</p></div>;
  if (!released) return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950"><h2 className="font-bold">Pengumuman belum dirilis</h2><p className="mt-1 text-sm leading-6">{tanggalRilis ? `Hasil dijadwalkan dapat dilihat pada ${formatDate(tanggalRilis)}.` : "Tanggal rilis belum ditentukan admin."}</p></div>;
  const accepted = status === "DITERIMA";
  return <div className={`rounded-2xl border p-6 ${accepted ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-red-200 bg-red-50 text-red-950"}`}><p className="text-xs font-bold uppercase tracking-[0.16em]">Hasil seleksi</p><h2 className="mt-2 text-3xl font-bold">{accepted ? "Diterima" : "Tidak diterima"}</h2></div>;
}
