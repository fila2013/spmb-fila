import type { Metadata } from "next";
import Link from "next/link";

import { DuUploadForm } from "@/components/admission/du-upload-form";
import { StageContentBlocks } from "@/components/stages/stage-content";
import { StatusPembayaran } from "@/generated/prisma/enums";
import { getAdmissionFeePageData } from "@/lib/admission/service";
import { requireWaliPage } from "@/lib/auth/navigation";

export const metadata: Metadata = { title: "Daftar Ulang" };

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

export default async function AdmissionFeePage({ params }: { params: Promise<{ id: string }> }) {
  const wali = await requireWaliPage();
  const data = await getAdmissionFeePageData((await params).id, wali.userId);
  const payment = data.payment;
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8">
      <Link href="/dashboard" className="text-sm font-bold text-emerald-800 hover:underline">← Dashboard</Link>
      <p className="mt-8 text-sm font-bold uppercase tracking-[0.17em] text-amber-700">Admission Fee</p>
      <h1 className="mt-2 text-3xl font-bold text-emerald-950">Daftar ulang · {data.child.namaAnak}</h1>
      <p className="mt-2 text-slate-600">{data.child.jalur} · {data.child.kategori}</p>
      <div className="mt-6"><StageContentBlocks content={data.content} /></div>
      {data.content.length === 0 ? <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Informasi kebijakan DU belum diterbitkan panitia.</p> : null}
      <section className="mt-6 rounded-2xl border border-emerald-950/10 bg-white p-5">
        <h2 className="font-bold text-emerald-950">Status pembayaran DU</h2>
        {!payment ? <p className="mt-2 text-sm text-slate-600">Belum ada bukti pembayaran yang dikirim.</p> : (
          <div className="mt-3 grid gap-2 text-sm text-slate-700">
            <p><span className="font-semibold">Status:</span> {payment.status === StatusPembayaran.PENDING ? "Menunggu verifikasi admin" : payment.status === StatusPembayaran.VERIFIED ? "Terverifikasi" : "Ditolak"}</p>
            {payment.nominal ? <p><span className="font-semibold">Nominal tercatat:</span> {rupiah(payment.nominal)}</p> : null}
            {payment.catatanAdmin ? <p className="rounded-xl bg-red-50 px-3 py-2 text-red-800"><span className="font-semibold">Catatan admin:</span> {payment.catatanAdmin}</p> : null}
            {payment.proofUrl ? <a href={payment.proofUrl} target="_blank" rel="noreferrer" className="font-bold text-emerald-800 hover:underline">Buka bukti pembayaran</a> : null}
          </div>
        )}
      </section>
      {data.mayUpload ? <div className="mt-6"><DuUploadForm childId={data.child.id} /></div> : null}
      {payment?.status === StatusPembayaran.PENDING ? <p className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950">Bukti sedang diperiksa. Unggah ulang tersedia setelah admin menolak bukti ini.</p> : null}
      {payment?.status === StatusPembayaran.VERIFIED ? <Link href={`/anak/${data.child.id}/join-wa`} className="mt-6 inline-flex rounded-xl bg-emerald-900 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-800">Lanjut ke Join WhatsApp</Link> : null}
    </main>
  );
}
