import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { AnnouncementResultForm, AssessmentResultForm } from "@/components/admin/stage-forms";
import { StatusAssessment, UserRole } from "@/generated/prisma/enums";
import { requireRolePage } from "@/lib/auth/navigation";
import { StageError } from "@/lib/stages/errors";
import { dateOnly } from "@/lib/stages/rules";
import { getParticipant } from "@/lib/stages/service";

export const metadata: Metadata = { title: "Detail peserta" };

export default async function ParticipantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireRolePage(UserRole.ADMIN);
  let participant;
  try { participant = await getParticipant((await params).id); } catch (error) { if (error instanceof StageError && error.code === "NOT_FOUND") notFound(); throw error; }
  return <AdminShell activePath="/admin/peserta" title={participant.namaAnak} description={`${participant.user.email} · ${participant.jalur?.nama ?? "Tanpa jalur"} · ${participant.kategori?.nama ?? "Tanpa kategori"}`} email={admin.email}>
    <Link href="/admin/peserta" className="mb-5 inline-flex text-sm font-bold text-emerald-800 hover:underline">← Kembali ke peserta</Link>
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-emerald-950/10 bg-white p-5"><h2 className="mb-4 text-lg font-bold text-emerald-950">Hasil assessment</h2><AssessmentResultForm id={participant.id} status={participant.hasilAssessment?.status ?? StatusAssessment.BELUM} catatan={participant.hasilAssessment?.catatan ?? ""} /></section>
      <section className="rounded-2xl border border-emerald-950/10 bg-white p-5"><h2 className="mb-4 text-lg font-bold text-emerald-950">Pengumuman</h2><AnnouncementResultForm id={participant.id} statusAkhir={participant.pengumuman?.statusAkhir ?? null} tanggalRilis={dateOnly(participant.pengumuman?.tanggalRilis ?? null) ?? ""} /></section>
      <section className="rounded-2xl border border-emerald-950/10 bg-white p-5 lg:col-span-2"><h2 className="text-lg font-bold text-emerald-950">Data enrollment</h2><dl className="mt-4 grid gap-3 sm:grid-cols-2">{participant.formResponses.map((response) => <div key={response.id} className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{response.field.label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{response.value || "—"}</dd></div>)}</dl>{participant.formResponses.length === 0 ? <p className="mt-3 text-sm text-slate-500">Belum ada jawaban enrollment.</p> : null}</section>
    </div>
  </AdminShell>;
}
