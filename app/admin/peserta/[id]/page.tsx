import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import {
  AdmissionVerificationForm,
  WhatsappInvitationForm,
} from "@/components/admin/admission-forms";
import { DeleteParticipantForm } from "@/components/admin/deletion-forms";
import { PaymentProofDeletion } from "@/components/admin/payment-proof-deletion";
import {
  AnnouncementResultForm,
  AssessmentResultForm,
} from "@/components/admin/stage-forms";
import {
  MetodePembayaran,
  PilihanJalurFinal,
  StatusAssessment,
  StatusKeseluruhan,
  StatusPembayaran,
  StatusUndanganWa,
  UserRole,
} from "@/generated/prisma/enums";
import { AdmissionError } from "@/lib/admission/errors";
import { getAdminAdmissionData } from "@/lib/admission/service";
import { requireRolePage } from "@/lib/auth/navigation";
import { StageError } from "@/lib/stages/errors";
import { PaymentError } from "@/lib/payment/errors";
import { getAdminRegistrationPaymentData } from "@/lib/payment/service";
import { dateOnly } from "@/lib/stages/rules";
import { getParticipant } from "@/lib/stages/service";

export const metadata: Metadata = { title: "Detail peserta" };

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function PaymentProofPreview({
  url,
  kind,
  title,
  downloadUrl,
}: {
  url: string;
  kind: "image" | "pdf" | null;
  title: string;
  downloadUrl: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <p className="text-sm font-bold text-slate-800">Preview bukti {kind === "pdf" ? "PDF" : "gambar"}</p>
        <div className="flex gap-3">
          <a href={url} target="_blank" rel="noreferrer" className="text-sm font-bold text-emerald-800 hover:underline">Buka</a>
          <a href={downloadUrl} className="text-sm font-bold text-emerald-800 hover:underline">Unduh</a>
        </div>
      </div>
      <iframe
        src={url}
        title={title}
        referrerPolicy="no-referrer"
        className="h-[28rem] w-full bg-white"
      />
    </div>
  );
}

export default async function ParticipantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireRolePage(UserRole.ADMIN);
  let participant;
  let admission;
  let registrationPayment;
  try {
    const id = (await params).id;
    [participant, admission, registrationPayment] = await Promise.all([
      getParticipant(id),
      getAdminAdmissionData(id),
      getAdminRegistrationPaymentData(id),
    ]);
  } catch (error) {
    if (
      (error instanceof StageError ||
        error instanceof AdmissionError ||
        error instanceof PaymentError) &&
      error.code === "NOT_FOUND"
    ) {
      notFound();
    }
    throw error;
  }
  const du = admission.payment;
  const whatsapp = admission.whatsapp;
  const announcementLocked = Boolean(participant.pilihanJalurFinal) ||
    participant.statusKeseluruhan === StatusKeseluruhan.MENUNGGU_PILIHAN_JALUR ||
    participant.statusKeseluruhan === StatusKeseluruhan.MENUNGGU_KUOTA_FALLBACK;

  return (
    <AdminShell
      activePath="/admin/peserta"
      title={participant.namaAnak}
      description={`${participant.user.email} · ${participant.jalur?.nama ?? participant.menungguFallbackJalur?.nama ?? participant.jalurAsal?.nama ?? "Tanpa jalur"} · ${participant.kategori?.nama ?? "Tanpa kategori"}`}
      email={admin.email}
    >
      <Link href="/admin/peserta" className="mb-5 inline-flex text-sm font-bold text-emerald-800 hover:underline">← Kembali ke peserta</Link>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-emerald-950/10 bg-white p-5">
          <h2 className="mb-4 text-lg font-bold text-emerald-950">Hasil assessment</h2>
          <AssessmentResultForm id={participant.id} status={participant.hasilAssessment?.status ?? StatusAssessment.BELUM} catatan={participant.hasilAssessment?.catatan ?? ""} />
        </section>
        <section className="rounded-2xl border border-emerald-950/10 bg-white p-5">
          <h2 className="mb-4 text-lg font-bold text-emerald-950">Pengumuman</h2>
          {announcementLocked ? <p className="rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">Hasil pengumuman sudah dirilis dan dikunci. Tahap selanjutnya dikelola oleh pilihan wali atau antrean kuota.</p> : <AnnouncementResultForm id={participant.id} statusAkhir={participant.pengumuman?.statusAkhir ?? null} tanggalRilis={dateOnly(participant.pengumuman?.tanggalRilis ?? null) ?? ""} childName={participant.namaAnak} requiresDeleteConfirmation={Boolean(participant.jalur?.hapusDataJikaGagal && !participant.jalur.fallbackJalurId)} finalRouteChoiceEnabled={Boolean(participant.jalur?.pilihanJalurFinalAktif)} />}
          {participant.pilihanJalurFinal ? <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950"><p className="font-bold">Pilihan jalur final wali</p><p className="mt-1">{participant.pilihanJalurFinal === PilihanJalurFinal.TETAP_JALUR_ASAL ? `Tetap ${participant.jalurAsal?.nama ?? participant.jalur?.nama ?? "jalur asal"}` : `Pindah ke ${participant.jalur?.nama ?? participant.menungguFallbackJalur?.nama ?? "jalur fallback"}`}</p><p className="mt-1 text-xs">Pilihan ini final{participant.pilihanJalurFinalAt ? ` · ${participant.pilihanJalurFinalAt.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}` : ""}.{participant.menungguFallbackJalur ? ` Sedang menunggu kuota ${participant.menungguFallbackJalur.nama}.` : ""}</p></div> : null}
        </section>
        <section className="rounded-2xl border border-emerald-950/10 bg-white p-5 lg:col-span-2">
          <h2 className="mb-4 text-lg font-bold text-emerald-950">Pembayaran pendaftaran</h2>
          {registrationPayment ? (
            <div className="grid gap-4">
              <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-3">
                <p><span className="font-semibold">Status:</span> {registrationPayment.status === StatusPembayaran.VERIFIED ? "Terverifikasi" : registrationPayment.status === StatusPembayaran.PENDING ? "Menunggu" : "Ditolak"}</p>
                <p><span className="font-semibold">Metode:</span> {registrationPayment.metodePembayaran === MetodePembayaran.MIDTRANS ? "Midtrans" : "Transfer manual"}</p>
                {registrationPayment.nominal ? <p><span className="font-semibold">Nominal:</span> {rupiah(registrationPayment.nominal)}</p> : null}
              </div>
              {registrationPayment.metodePembayaran === MetodePembayaran.MANUAL_TRANSFER ? (
                registrationPayment.proofUrl ? (
                  <PaymentProofPreview
                    url={registrationPayment.proofUrl}
                    kind={registrationPayment.proofKind}
                    title="Preview bukti pembayaran pendaftaran"
                    downloadUrl={`/api/admin/pembayaran/${registrationPayment.id}/bukti`}
                  />
                ) : <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">File bukti sudah dihapus atau tidak tersedia.</p>
              ) : <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Pembayaran diproses melalui webhook Midtrans dan tidak memiliki file bukti manual.</p>}
              {registrationPayment.fileBuktiUrl && registrationPayment.status !== StatusPembayaran.PENDING ? (
                <PaymentProofDeletion paymentId={registrationPayment.id} />
              ) : null}
            </div>
          ) : <p className="text-sm text-slate-600">Belum ada pembayaran pendaftaran.</p>}
        </section>
        <section className="rounded-2xl border border-emerald-950/10 bg-white p-5 lg:col-span-2">
          <h2 className="mb-4 text-lg font-bold text-emerald-950">Pembayaran DU</h2>
          {du ? (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
              <div className="grid gap-4">
                <div className="grid gap-2 text-sm text-slate-700">
                  <p><span className="font-semibold">Status:</span> {du.status === StatusPembayaran.PENDING ? "Menunggu verifikasi" : du.status === StatusPembayaran.VERIFIED ? "Terverifikasi" : "Ditolak"}</p>
                  {du.nominal ? <p><span className="font-semibold">Nominal:</span> {rupiah(du.nominal)}</p> : null}
                  {du.catatanAdmin ? <p><span className="font-semibold">Catatan:</span> {du.catatanAdmin}</p> : null}
                </div>
                {du.proofUrl ? <PaymentProofPreview url={du.proofUrl} kind={du.proofKind} title="Preview bukti pembayaran DU" downloadUrl={`/api/admin/pembayaran/${du.id}/bukti`} /> : <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">File bukti sudah dihapus atau tidak tersedia.</p>}
                {du.fileBuktiUrl && du.status !== StatusPembayaran.PENDING ? <PaymentProofDeletion paymentId={du.id} /> : null}
              </div>
              <div>
                {du.status === StatusPembayaran.PENDING ? (
                  <AdmissionVerificationForm childId={participant.id} paymentId={du.id} />
                ) : (
                  <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Keputusan pembayaran ini sudah final.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600">Wali belum mengunggah bukti pembayaran DU.</p>
          )}
        </section>
        <section className="rounded-2xl border border-emerald-950/10 bg-white p-5">
          <h2 className="mb-4 text-lg font-bold text-emerald-950">Undangan grup WhatsApp</h2>
          {du?.status === StatusPembayaran.VERIFIED ? (
            <div className="grid gap-4">
              {whatsapp?.linkDibukaAt && !whatsapp.confirmedAt ? <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-900">Wali sudah membuka link dan belum mengonfirmasi bergabung.</p> : null}
              <WhatsappInvitationForm childId={participant.id} inviteUrl={whatsapp?.inviteUrl ?? ""} confirmed={whatsapp?.status === StatusUndanganWa.SUDAH_DIUNDANG} confirmedAt={whatsapp?.confirmedAt ?? null} />
            </div>
          ) : (
            <p className="text-sm text-slate-600">Link undangan tersedia setelah pembayaran DU terverifikasi.</p>
          )}
        </section>
        <section className="rounded-2xl border border-emerald-950/10 bg-white p-5 lg:col-span-2">
          <h2 className="text-lg font-bold text-emerald-950">Data enrollment</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {participant.formResponses.map((response) => (
              <div key={response.id} className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{response.field.label}</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{response.value || "—"}</dd>
              </div>
            ))}
          </dl>
          {participant.formResponses.length === 0 ? <p className="mt-3 text-sm text-slate-500">Belum ada jawaban enrollment.</p> : null}
        </section>
        <section className="rounded-2xl border border-red-200 bg-red-50 p-5 lg:col-span-2">
          <h2 className="mb-2 text-lg font-bold text-red-950">Zona berbahaya</h2>
          <DeleteParticipantForm id={participant.id} name={participant.namaAnak} />
        </section>
      </div>
    </AdminShell>
  );
}
