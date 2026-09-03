import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import {
  BankAccountForm,
  DeleteBankAccountForm,
  PaymentModeForm,
} from "@/components/admin/payment-settings-forms";
import { ModePembayaranPendaftaran, UserRole } from "@/generated/prisma/enums";
import { requireRolePage } from "@/lib/auth/navigation";
import { getPaymentSettingsData } from "@/lib/payment-settings/service";

export const metadata: Metadata = { title: "Pengaturan pembayaran" };

export default async function PaymentSettingsPage() {
  const admin = await requireRolePage(UserRole.ADMIN);
  const settings = await getPaymentSettingsData();
  return (
    <AdminShell activePath="/admin/settings" title="Pengaturan pembayaran" description="Pilih alur pembayaran pendaftaran dan kelola rekening bank sekolah tanpa mengubah integrasi Midtrans." email={admin.email}>
      <section className="rounded-2xl border border-emerald-950/10 bg-white p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-bold text-emerald-950">Mode pembayaran aktif</h2><p className="mt-1 text-sm text-slate-600">Perubahan berlaku untuk transaksi pendaftaran baru.</p></div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${settings.mode === ModePembayaranPendaftaran.MIDTRANS ? "bg-sky-100 text-sky-900" : "bg-amber-100 text-amber-900"}`}>{settings.mode === ModePembayaranPendaftaran.MIDTRANS ? "MIDTRANS" : "MANUAL"}</span>
        </div>
        <PaymentModeForm mode={settings.mode} />
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">Mode manual memverifikasi pembayaran berdasarkan keberhasilan upload bukti, tanpa pemeriksaan nominal mutasi oleh admin. Bukti tetap tersedia pada detail peserta untuk audit.</p>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="grid gap-4">
          <h2 className="text-lg font-bold text-emerald-950">Rekening bank sekolah</h2>
          {settings.bankAccounts.length ? settings.bankAccounts.map((account) => (
            <article key={account.id} className="rounded-2xl border border-emerald-950/10 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="font-bold text-emerald-950">{account.namaBank}</h3><p className="mt-1 font-mono text-lg text-slate-900">{account.nomorRekening}</p><p className="text-sm text-slate-600">a.n. {account.atasNama}</p></div><DeleteBankAccountForm id={account.id} /></div>
              <details className="mt-4 border-t border-slate-100 pt-4"><summary className="cursor-pointer text-sm font-bold text-emerald-800">Edit rekening</summary><div className="mt-4"><BankAccountForm value={account} /></div></details>
            </article>
          )) : <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">Belum ada rekening. Tambahkan rekening sebelum mengaktifkan mode manual.</p>}
        </section>
        <aside className="h-fit rounded-2xl border border-emerald-950/10 bg-white p-5 xl:sticky xl:top-6"><h2 className="mb-4 text-lg font-bold text-emerald-950">Tambah rekening</h2><BankAccountForm /></aside>
      </div>
    </AdminShell>
  );
}
