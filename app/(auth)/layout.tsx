import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="bg-[radial-gradient(circle_at_top_right,_rgba(217,158,54,0.16),_transparent_35%),linear-gradient(180deg,#f2faf5_0%,#ffffff_70%)] px-5 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-md">
        <Link href="/" className="mb-5 inline-flex text-sm font-semibold text-emerald-800 hover:underline">
          ← Kembali ke beranda
        </Link>
        <div className="rounded-3xl border border-emerald-950/10 bg-white p-6 shadow-[0_24px_70px_rgba(6,78,59,0.10)] sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}

