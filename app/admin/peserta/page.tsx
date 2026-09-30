import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import { StatusKeseluruhan, UserRole } from "@/generated/prisma/enums";
import { requireRolePage } from "@/lib/auth/navigation";
import {
  formatParticipantRegistrationDate,
  statusPresentation,
} from "@/lib/calon-murid/presentation";
import { listJalur, listKategori } from "@/lib/master-data/service";
import { participantListFilterSchema } from "@/lib/stages/schemas";
import { listParticipants } from "@/lib/stages/service";

export const metadata: Metadata = { title: "Peserta SPMB" };

type SearchParams = Record<string, string | string[] | undefined>;

function searchParamsRecord(searchParams: SearchParams) {
  return Object.fromEntries(
    Object.entries(searchParams).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );
}

function FilterSelect({
  name,
  label,
  defaultValue,
  children,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
      <span>{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-900"
      >
        <option value="">Semua</option>
        {children}
      </select>
    </label>
  );
}

export default async function ParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const admin = await requireRolePage(UserRole.ADMIN);
  const rawFilters = searchParamsRecord(await searchParams);
  const parsed = participantListFilterSchema.safeParse(rawFilters);
  const filters = parsed.success ? parsed.data : {};
  const [jalur, kategori, participants] = await Promise.all([
    listJalur(),
    listKategori(),
    listParticipants(filters),
  ]);

  return (
    <AdminShell
      activePath="/admin/peserta"
      title="Peserta"
      description="Kelola assessment, pengumuman, pembayaran DU, link grup, dan konfirmasi WhatsApp setiap calon murid."
      email={admin.email}
    >
      {rawFilters.deleted === "1" ? (
        <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
          Data pribadi calon murid telah dihapus. Akun wali, anak lain, jejak pembayaran, dan snapshot audit tetap tersimpan.
        </p>
      ) : null}
      {!parsed.success ? (
        <p className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          Sebagian filter tidak valid dan telah diabaikan.
        </p>
      ) : null}

      <form className="rounded-2xl border border-emerald-950/10 bg-white p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700 sm:col-span-2 xl:col-span-3">
            <span>Cari nama peserta</span>
            <input
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Nama calon murid"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-900"
            />
          </label>
          <FilterSelect name="jalurId" label="Jalur" defaultValue={filters.jalurId}>
            {jalur.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nama}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            name="kategoriId"
            label="Kategori"
            defaultValue={filters.kategoriId}
          >
            {kategori.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nama}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            name="statusKeseluruhan"
            label="Status tahapan"
            defaultValue={filters.statusKeseluruhan}
          >
            {Object.values(StatusKeseluruhan).map((status) => (
              <option key={status} value={status}>
                {statusPresentation[status].label}
              </option>
            ))}
          </FilterSelect>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className="rounded-xl bg-emerald-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800">
            Terapkan filter
          </button>
          <Link
            href="/admin/peserta"
            className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Reset
          </Link>
        </div>
      </form>

      <section className="mt-6 rounded-2xl border border-emerald-950/10 bg-white p-5 sm:p-6">
        <div>
          <h2 className="text-xl font-bold text-emerald-950">Daftar peserta</h2>
          <p className="mt-1 text-sm text-slate-600">
            {participants.length} peserta sesuai filter.
          </p>
        </div>
        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-emerald-950 text-white">
              <tr>
                <th className="px-4 py-3">Peserta</th>
                <th className="px-4 py-3">Jalur / kategori</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {participants.map((item) => {
                const status = statusPresentation[item.statusKeseluruhan];
                return (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{item.namaAnak}</p>
                      <p className="text-xs text-slate-500">{item.user.email}</p>
                      <time
                        dateTime={item.createdAt.toISOString()}
                        className="mt-1 block text-xs text-slate-500"
                      >
                        Tgl daftar: {formatParticipantRegistrationDate(item.createdAt)}
                      </time>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {item.jalur?.nama ??
                        item.menungguFallbackJalur?.nama ??
                        item.jalurAsal?.nama ??
                        "—"}{" "}
                      / {item.kategori?.nama ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/peserta/${item.id}`}
                        className="font-bold text-emerald-800 hover:underline"
                      >
                        Kelola
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {participants.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-600">
              Tidak ada peserta yang cocok dengan filter.
            </p>
          ) : null}
        </div>
      </section>
    </AdminShell>
  );
}
