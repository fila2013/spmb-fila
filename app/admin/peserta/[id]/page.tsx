import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { AdmissionVerificationForm, WhatsappInvitationForm } from "@/components/admin/admission-forms";
import { AnnouncementResultForm, AssessmentResultForm } from "@/components/admin/stage-forms";
import { StatusAssessment, StatusPembayaran, StatusUndanganWa, UserRole } from "@/generated/prisma/enums";
import { AdmissionError } from "@/lib/admission/errors";
import { getAdminAdmissionData } from "@/lib/admission/service";
import { requireRolePage } from "@/lib/auth/navigation";
import { StageError } from "@/lib/stages/errors";
import { dateOnly } from "@/lib/stages/rules";
import { getParticipant } from "@/lib/stages/service";

export const metadata: Metadata = { title: "Detail peserta" };

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

export default async function ParticipantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireRolePage(UserRole.ADMIN);
  let participant;
  let admission;
  try {
    const id = (await params).id;
    [participant, admission] = await Promise.all([getParticipant(id), getAdminAdmissionData(id)]);
  } catch (error) { if ((error instanceof StageError || error instanceof AdmissionError) && error.code === "NOT_FOUND") notFound(); throw error; }
  const du = admission.payment;
  return <AdminShell activePath="/admin/peserta" title={participant.namaAnak} description={`${participant.user.email} · ${participant.jalur?.nama ?? "Tanpa jalur"} · ${participant.kategori?.nama ?? "Tanpa kategori"}`} email={admin.email}>
    <Link href="/admin/peserta" className="mb-5 inline-flex text-sm font-bold text-emerald-800 hover:underline">← Kembali ke peserta</Link>
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-emerald-950/10 bg-white p-5"><h2 className="mb-4 text-lg font-bold text-emerald-950">Hasil assessment</h2><AssessmentResultForm id={participant.id} status={participant.hasilAssessment?.status ?? StatusAssessment.BELUM} catatan={participant.hasilAssessment?.catatan ?? ""} /></section>
      <section className="rounded-2xl border border-emerald-950/10 bg-white p-5"><h2 className="mb-4 text-lg font-bold text-emerald-950">Pengumuman</h2><AnnouncementResultForm id={participant.id} statusAkhir={participant.pengumuman?.statusAkhir ?? null} tanggalRilis={dateOnly(participant.pengumuman?.tanggalRilis ?? null) ?? ""} childName={participant.namaAnak} requiresDeleteConfirmation={Boolean(participant.jalur?.hapusDataJikaGagal && !participant.jalur.fallbackJalurId)} /></section>
      <section className="rounded-2xl border border-emerald-950/10 bg-white p-5"><h2 className="mb-4 text-lg font-bold text-emerald-950">Pembayaran DU</h2>{du ? <div className="grid gap-4"><div className="grid gap-2 text-sm text-slate-700"><p><span className="font-semibold">Status:</span> {du.status === StatusPembayaran.PENDING ? "Menunggu verifikasi" : du.status === StatusPembayaran.VERIFIED ? "Terverifikasi" : "Ditolak"}</p>{du.nominal ? <p><span className="font-semibold">Nominal:</span> {rupiah(du.nominal)}</p> : null}{du.catatanAdmin ? <p><span className="font-semibold">Catatan:</span> {du.catatanAdmin}</p> : null}{du.proofUrl ? <a href={du.proofUrl} target="_blank" rel="noreferrer" className="font-bold text-emerald-800 hover:underline">Buka bukti pembayaran</a> : null}</div>{du.status === StatusPembayaran.PENDING ? <AdmissionVerificationForm childId={participant.id} paymentId={du.id} /> : null}</div> : <p className="text-sm text-slate-600">Wali belum mengunggah bukti pembayaran DU.</p>}</section>
      <section className="rounded-2xl border border-emerald-950/10 bg-white p-5"><h2 className="mb-4 text-lg font-bold text-emerald-950">Undangan grup WhatsApp</h2>{du?.status === StatusPembayaran.VERIFIED ? <WhatsappInvitationForm childId={participant.id} status={admission.whatsappStatus ?? StatusUndanganWa.MENUNGGU} /> : <p className="text-sm text-slate-600">Status undangan tersedia setelah pembayaran DU terverifikasi.</p>}</section>
      <section className="rounded-2xl border border-emerald-950/10 bg-white p-5 lg:col-span-2"><h2 className="text-lg font-bold text-emerald-950">Data enrollment</h2><dl className="mt-4 grid gap-3 sm:grid-cols-2">{participant.formResponses.map((response) => <div key={response.id} className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{response.field.label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{response.value || "—"}</dd></div>)}</dl>{participant.formResponses.length === 0 ? <p className="mt-3 text-sm text-slate-500">Belum ada jawaban enrollment.</p> : null}</section>
    </div>
  </AdminShell>;
}
