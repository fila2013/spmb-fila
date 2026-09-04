import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { confirmEmailAction } from "@/app/auth/confirm/actions";
import { authCodeCallbackPath } from "@/lib/auth/confirmation";
import { safeRedirectPath } from "@/lib/auth/redirect";

export const metadata: Metadata = { title: "Konfirmasi email" };

export default async function ConfirmEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const code = typeof params.code === "string" ? params.code : "";
  const tokenHash = typeof params.token_hash === "string" ? params.token_hash : "";
  const type = typeof params.type === "string" ? params.type : "";
  const rawNext = typeof params.next === "string" ? params.next : undefined;
  if (code) {
    redirect(authCodeCallbackPath(code, type === "recovery" || rawNext === "/reset-password"));
  }
  if (params.error || params.error_code) {
    redirect(params.error_code === "otp_expired" ? "/login?auth=otp_expired" : "/login?auth=invalid");
  }
  const next = safeRedirectPath(
    rawNext,
  );
  const linkIsComplete = Boolean(tokenHash && type);

  return (
    <div className="mx-auto w-full max-w-md px-5 py-16">
      <div className="rounded-3xl border border-emerald-950/10 bg-white p-6 text-center shadow-[0_24px_70px_rgba(6,78,59,0.10)] sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.17em] text-amber-700">
          Verifikasi akun
        </p>
        <h1 className="mt-2 text-3xl font-bold text-emerald-950">
          Konfirmasi email Anda
        </h1>
        <p className="mt-4 leading-7 text-slate-600">
          Tekan tombol berikut untuk menyelesaikan verifikasi. Tautan baru
          digunakan setelah Anda menekan tombol ini.
        </p>

        {linkIsComplete ? (
          <form action={confirmEmailAction} className="mt-7">
            <input type="hidden" name="tokenHash" value={tokenHash} />
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="next" value={next} />
            <button className="w-full rounded-xl bg-emerald-900 px-5 py-3.5 text-sm font-bold text-white hover:bg-emerald-800">
              Konfirmasi email
            </button>
          </form>
        ) : (
          <p className="mt-7 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Tautan konfirmasi tidak lengkap. Minta email konfirmasi baru.
          </p>
        )}
      </div>
    </div>
  );
}
