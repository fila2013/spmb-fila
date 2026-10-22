import type { StatusPengumuman } from "@/generated/prisma/enums";
import { googleCalendarReminderUrl } from "@/lib/stages/rules";
import { whatsappTextParts, whatsappUrlsFromContent } from "@/lib/admission/whatsapp-links";
import { WhatsappGroupLinks } from "@/components/admission/whatsapp-group-links";

/* eslint-disable @next/next/no-img-element -- CMS URLs are runtime-configured Supabase Storage assets. */

export type PublicStageContent = {
  id: string;
  judul: string;
  tanggal: string | null;
  isiTeks: string | null;
  gambarUrl: string | null;
  youtubeVideoId: string | null;
  judulTutorial?: string | null;
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

function youtubeEmbedUrl(videoId: string, autoplay: boolean) {
  const params = new URLSearchParams({
    playsinline: "1",
    rel: "0",
  });
  if (autoplay) {
    params.set("autoplay", "1");
    params.set("mute", "1");
  }
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

function StageVideo({ item, tutorialMode }: { item: PublicStageContent; tutorialMode: boolean }) {
  return <>
    {tutorialMode && item.judulTutorial ? <h3 className="mt-5 text-lg font-bold text-emerald-950">{item.judulTutorial}</h3> : null}
    {item.youtubeVideoId ? <>
      <div className="mt-4 aspect-video overflow-hidden rounded-xl bg-slate-950"><iframe src={youtubeEmbedUrl(item.youtubeVideoId, !tutorialMode)} title={item.judulTutorial ?? item.judul} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen className="h-full w-full border-0" /></div>
      {tutorialMode ? <a href={`https://www.youtube.com/watch?v=${item.youtubeVideoId}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline">Buka tutorial di YouTube</a> : null}
    </> : null}
  </>;
}

export function StageContentBlocks({
  content,
  calendarContext,
  tutorialMode = false,
  whatsappMode = false,
  onWhatsappOpen,
}: {
  content: PublicStageContent[];
  calendarContext?: CalendarContext;
  tutorialMode?: boolean;
  whatsappMode?: boolean;
  onWhatsappOpen?: (url: string) => void;
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
        {!tutorialMode ? <StageVideo item={item} tutorialMode={false} /> : null}
        {item.isiTeks ? <p className="mt-3 whitespace-pre-wrap break-words leading-7 text-slate-700">{whatsappMode ? whatsappTextParts(item.isiTeks).map(({ url, text }, index) => url ? <a key={index} href={url} target="_blank" rel="noopener noreferrer" onClick={() => onWhatsappOpen?.(url)} className="break-all text-blue-600 underline hover:text-blue-800">{text}</a> : text) : item.isiTeks}</p> : null}
        {whatsappMode ? whatsappUrlsFromContent([item]).map((url) => <div key={url} className="mt-4"><WhatsappGroupLinks inviteUrl={url} showUrl={false} onOpen={() => onWhatsappOpen?.(url)} /></div>) : null}
        {tutorialMode ? <StageVideo item={item} tutorialMode /> : null}
        {calendarUrl ? <a href={calendarUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex rounded-xl border border-emerald-800/20 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-900 hover:bg-emerald-100">Tambahkan ke Google Calendar</a> : null}
      </div>
    </article>;
  })}</div>;
}

export function AnnouncementBanner({ released, status, waitingQuota, fallbackJalur }: { released: boolean; status: StatusPengumuman | null; waitingQuota: boolean; fallbackJalur: string | null }) {
  if (!released) return null;
  if (waitingQuota) return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950"><h2 className="font-bold">Menunggu Kuota</h2><p className="mt-1 text-sm leading-6">Pendaftaran sedang menunggu ketersediaan kuota{fallbackJalur ? ` di jalur ${fallbackJalur}` : " pada jalur lanjutan"}. Panitia akan memperbarui status sesuai urutan pendaftaran.</p></div>;
  const accepted = status === "DITERIMA";
  return <div className={`rounded-2xl border p-6 ${accepted ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-red-200 bg-red-50 text-red-950"}`}><p className="text-xs font-bold uppercase tracking-[0.16em]">Hasil seleksi</p><h2 className="mt-2 text-3xl font-bold">{accepted ? "Diterima" : "Tidak diterima"}</h2></div>;
}
