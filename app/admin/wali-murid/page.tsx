import type { Metadata } from "next";
import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { DeleteGuardianForm } from "@/components/admin/deletion-forms";
import { UserRole } from "@/generated/prisma/enums";
import {
  getGuardianStatusCounts,
  type GuardianStatusFilter,
  listGuardians,
} from "@/lib/admin-deletion/service";
import { requireRolePage } from "@/lib/auth/navigation";

export const metadata: Metadata = { title: "Wali murid" };

export default async function GuardiansPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; deleted?: string; status?: string }>;
}) {
  const admin = await requireRolePage(UserRole.ADMIN);
  const filters = await searchParams;
  const query = filters.q?.trim().slice(0, 100) ?? "";
  const status: GuardianStatusFilter = [
    "active",
    "not_active",
    "pending",
    "inactive",
    "all",
  ].includes(filters.status ?? "")
    ? (filters.status as GuardianStatusFilter)
    : "active";
  const [guardians, statusCounts] = await Promise.all([
    listGuardians(query, status),
    getGuardianStatusCounts(query),
  ]);

  const statusLabels: Record<GuardianStatusFilter, string> = {
    active: "aktif",
    not_active: "tidak aktif",
    pending: "menunggu verifikasi email",
    inactive: "dinonaktifkan",
    all: "semua status",
  };

  return (
    <AdminShell
      activePath="/admin/wali-murid"
      title="Wali murid"
      description="Kelola akun wali berdasarkan status verifikasi email. Akun hanya dapat dihapus setelah semua peserta/anak dihapus satu per satu."
      email={admin.email}
    >
      {filters.deleted === "1" ? (
        <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
          Identitas Supabase Auth dan profil aplikasi wali telah dihapus.
        </p>
      ) : null}
      <section aria-label="Ringkasan akun wali" className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-emerald-950/10 bg-white p-5">
          <p className="text-sm font-semibold text-slate-600">Total akun</p>
          <p className="mt-1 text-3xl font-bold text-emerald-950">
            {statusCounts.total}
          </p>
        </article>
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-semibold text-emerald-800">Aktif</p>
          <p className="mt-1 text-3xl font-bold text-emerald-950">
            {statusCounts.active}
          </p>
        </article>
        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-semibold text-amber-800">Tidak aktif</p>
          <p className="mt-1 text-3xl font-bold text-amber-950">
            {statusCounts.notActive}
          </p>
          <p className="mt-1 text-xs leading-5 text-amber-900">
            {statusCounts.pending} menunggu verifikasi · {statusCounts.inactive}{" "}
            dinonaktifkan
          </p>
        </article>
      </section>

      <form className="mt-6 rounded-2xl border border-emerald-950/10 bg-white p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_260px]">
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            <span>Cari wali murid</span>
            <input
              name="q"
              defaultValue={query}
              placeholder="Email wali atau nama anak"
              className="min-w-0 rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-normal text-slate-900"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            <span>Status akun</span>
            <select
              name="status"
              defaultValue={status}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-normal text-slate-900"
            >
              <option value="all">Semua status</option>
              <option value="active">Aktif</option>
              <option value="not_active">Tidak aktif</option>
              <option value="pending">Menunggu verifikasi email</option>
              <option value="inactive">Dinonaktifkan admin</option>
            </select>
          </label>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className="rounded-xl bg-emerald-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800">
            Terapkan filter
          </button>
          <Link
            href="/admin/wali-murid"
            className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Reset
          </Link>
        </div>
      </form>

      <div className="mb-5 mt-6">
        <h2 className="text-xl font-bold text-emerald-950">Daftar wali murid</h2>
        <p className="mt-1 text-sm text-slate-600">
          {guardians.length} akun {statusLabels[status]} sesuai filter.
        </p>
      </div>
      <div className="grid gap-4">
        {guardians.map((guardian) => (
          <article
            key={guardian.id}
            className="rounded-2xl border border-emerald-950/10 bg-white p-5"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold text-emerald-950">{guardian.email}</h2>
                  {!guardian.emailVerifiedAt ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900">
                      Menunggu Verifikasi Email
                    </span>
                  ) : guardian.statusAktif ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-900">
                      Aktif
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-bold text-slate-700">
                      Dinonaktifkan
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {guardian._count.calonMurid} peserta/anak
                </p>
                {guardian.calonMurid.length ? (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {guardian.calonMurid.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={`/admin/peserta/${child.id}`}
                          className="inline-flex rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100"
                        >
                          {child.namaAnak}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="w-full lg:max-w-md">
                {guardian._count.calonMurid === 0 ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                    <DeleteGuardianForm id={guardian.id} email={guardian.email} />
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                    Penghapusan akun dikunci. Buka dan hapus setiap peserta di
                    sebelah kiri terlebih dahulu.
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {guardians.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">
          Akun wali tidak ditemukan.
        </p>
      ) : null}
    </AdminShell>
  );
}
