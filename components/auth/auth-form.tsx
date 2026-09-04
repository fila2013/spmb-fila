"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useActionState, useState } from "react";

import {
  forgotPasswordAction,
  loginAction,
  registerAction,
  resetPasswordAction,
} from "@/app/(auth)/actions";
import { initialAuthActionState } from "@/lib/auth/action-state";

type FieldProps = {
  label: string;
  name: string;
  type: "email" | "password";
  autoComplete: string;
  error?: string[];
};

function Field({ label, name, type, autoComplete, error }: FieldProps) {
  const errorId = `${name}-error`;
  const isPassword = type === "password";
  const [passwordVisible, setPasswordVisible] = useState(false);

  return (
    <div className="block text-sm font-semibold text-slate-800">
      <label htmlFor={name}>{label}</label>
      <div className="relative mt-2">
        <input
          id={name}
          name={name}
          type={isPassword && passwordVisible ? "text" : type}
          autoComplete={autoComplete}
          required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={`w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10 ${isPassword ? "pr-12" : ""}`}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setPasswordVisible((visible) => !visible)}
            aria-label={passwordVisible ? "Sembunyikan password" : "Tampilkan password"}
            aria-pressed={passwordVisible}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500 transition hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-700"
          >
            {passwordVisible ? (
              <EyeOff aria-hidden="true" size={20} />
            ) : (
              <Eye aria-hidden="true" size={20} />
            )}
          </button>
        ) : null}
      </div>
      {error ? (
        <span id={errorId} className="mt-1 block text-xs font-medium text-red-700">
          {error[0]}
        </span>
      ) : null}
    </div>
  );
}

function Notice({ state }: { state: typeof initialAuthActionState }) {
  if (!state.message) return null;

  return (
    <p
      aria-live="polite"
      className={`rounded-xl border px-4 py-3 text-sm leading-6 ${
        state.status === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-red-200 bg-red-50 text-red-800"
      }`}
    >
      {state.message}
    </p>
  );
}

export function LoginForm({ portal = "wali" }: { portal?: "wali" | "admin" }) {
  const [state, action, pending] = useActionState(
    loginAction,
    initialAuthActionState,
  );

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="portal" value={portal} />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        error={state.fieldErrors?.email}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        error={state.fieldErrors?.password}
      />
      <Notice state={state} />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-emerald-900 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-65"
      >
        {pending ? "Memeriksa akun…" : "Masuk"}
      </button>
      {portal === "wali" ? (
        <div className="flex flex-wrap justify-between gap-3 text-sm">
          <Link className="font-semibold text-emerald-800 hover:underline" href="/register">
            Buat akun
          </Link>
          <Link className="text-slate-600 hover:underline" href="/forgot-password">
            Lupa password?
          </Link>
        </div>
      ) : null}
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(
    registerAction,
    initialAuthActionState,
  );

  return (
    <form action={action} className="space-y-5">
      <Field label="Email" name="email" type="email" autoComplete="email" error={state.fieldErrors?.email} />
      <Field label="Password (minimal 8 karakter)" name="password" type="password" autoComplete="new-password" error={state.fieldErrors?.password} />
      <Field label="Konfirmasi password" name="confirmPassword" type="password" autoComplete="new-password" error={state.fieldErrors?.confirmPassword} />
      <Notice state={state} />
      <button type="submit" disabled={pending} className="w-full rounded-xl bg-emerald-900 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:opacity-65">
        {pending ? "Membuat akun…" : "Buat akun"}
      </button>
      <p className="text-center text-sm text-slate-600">
        Sudah punya akun? <Link href="/login" className="font-semibold text-emerald-800 hover:underline">Masuk</Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, initialAuthActionState);
  return (
    <form action={action} className="space-y-5">
      <Field label="Email akun" name="email" type="email" autoComplete="email" error={state.fieldErrors?.email} />
      <Notice state={state} />
      <button type="submit" disabled={pending} className="w-full rounded-xl bg-emerald-900 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:opacity-65">
        {pending ? "Mengirim…" : "Kirim tautan reset"}
      </button>
      <p className="text-center text-sm"><Link href="/login" className="font-semibold text-emerald-800 hover:underline">Kembali ke login</Link></p>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(resetPasswordAction, initialAuthActionState);
  return (
    <form action={action} className="space-y-5">
      <Field label="Password baru" name="password" type="password" autoComplete="new-password" error={state.fieldErrors?.password} />
      <Field label="Konfirmasi password baru" name="confirmPassword" type="password" autoComplete="new-password" error={state.fieldErrors?.confirmPassword} />
      <Notice state={state} />
      <button type="submit" disabled={pending} className="w-full rounded-xl bg-emerald-900 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:opacity-65">
        {pending ? "Menyimpan…" : "Simpan password baru"}
      </button>
    </form>
  );
}
