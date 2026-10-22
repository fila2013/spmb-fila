import { StatusPengumuman } from "@/generated/prisma/enums";

export function AnnouncementLetter({ text, status }: { text: string; status: StatusPengumuman }) {
  const accepted = status === StatusPengumuman.DITERIMA;
  return <article aria-labelledby="announcement-letter-title" className="overflow-hidden rounded-2xl border border-emerald-950/10 bg-white shadow-sm">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-5 sm:px-8">
      <h2 id="announcement-letter-title" className="text-lg font-bold text-emerald-950">Surat Pengumuman Hasil Seleksi</h2>
      <span className={`rounded-full px-3 py-1 text-xs font-bold ${accepted ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-900"}`}>{accepted ? "DITERIMA" : "TIDAK DITERIMA"}</span>
    </header>
    <p className="whitespace-pre-wrap break-words px-6 py-7 text-sm leading-7 text-slate-800 sm:px-8 sm:text-base sm:leading-8">{text}</p>
  </article>;
}
