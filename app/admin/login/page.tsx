import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Login admin" };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <div className="mx-auto w-full max-w-md px-5 py-16">
      <div className="rounded-3xl border border-emerald-950/10 bg-white p-6 shadow-[0_24px_70px_rgba(6,78,59,0.10)] sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.17em] text-amber-700">Area internal</p><h1 className="mt-2 text-3xl font-bold text-emerald-950">Login administrator</h1><p className="mb-7 mt-3 leading-7 text-slate-600">Hanya akun dengan role admin aktif yang dapat masuk.</p>
        {params.auth === "forbidden" ? <p className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">Session tidak memiliki akses administrator.</p> : null}
        <LoginForm portal="admin" />
      </div>
    </div>
  );
}
