"use server";

import { redirect } from "next/navigation";

import { UserRole } from "@/generated/prisma/enums";
import type { AuthActionState } from "@/lib/auth/action-state";
import { signupErrorMessage } from "@/lib/auth/messages";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/auth/schemas";
import { ensureUserProfile } from "@/lib/auth/profile";
import { getAppEnvironment } from "@/lib/env/client";
import { createClient } from "@/lib/supabase/server";

function values(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function invalidState(fieldErrors: Record<string, string[] | undefined>) {
  return {
    status: "error" as const,
    message: "Periksa kembali data yang Anda masukkan.",
    fieldErrors: Object.fromEntries(
      Object.entries(fieldErrors).filter((entry): entry is [string, string[]] =>
        Boolean(entry[1]),
      ),
    ),
  };
}

export async function registerAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = registerSchema.safeParse(values(formData));
  if (!parsed.success) {
    return invalidState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();
  const environment = getAppEnvironment();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${environment.NEXT_PUBLIC_APP_URL}/auth/confirm`,
    },
  });

  if (error) {
    console.error("Supabase sign-up gagal.", {
      code: error.code ?? "unknown",
      status: error.status,
    });
    return {
      status: "error",
      message: signupErrorMessage(error.code),
    };
  }

  if (data.session && data.user?.email) {
    await ensureUserProfile({ id: data.user.id, email: data.user.email });
    redirect("/dashboard");
  }

  return {
    status: "success",
    message:
      "Jika alamat email dapat didaftarkan, tautan konfirmasi telah dikirim. Periksa juga folder spam.",
  };
}

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse(values(formData));
  if (!parsed.success) {
    return invalidState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user.email) {
    return {
      status: "error",
      message: "Email atau password tidak sesuai.",
    };
  }

  const profile = await ensureUserProfile({
    id: data.user.id,
    email: data.user.email,
  });

  if (!profile.statusAktif) {
    await supabase.auth.signOut();
    return {
      status: "error",
      message: "Akun tidak aktif. Hubungi panitia SPMB.",
    };
  }

  if (parsed.data.portal === "admin" && profile.role !== UserRole.ADMIN) {
    await supabase.auth.signOut();
    return {
      status: "error",
      message: "Akun tidak memiliki akses administrator.",
    };
  }

  redirect(profile.role === UserRole.ADMIN ? "/admin/dashboard" : "/dashboard");
}

export async function forgotPasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse(values(formData));
  if (!parsed.success) {
    return invalidState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();
  const environment = getAppEnvironment();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${environment.NEXT_PUBLIC_APP_URL}/auth/confirm`,
  });

  return {
    status: "success",
    message:
      "Jika email terdaftar, tautan reset password telah dikirim. Periksa juga folder spam.",
  };
}

export async function resetPasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse(values(formData));
  if (!parsed.success) {
    return invalidState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return {
      status: "error",
      message: "Tautan reset tidak valid atau telah kedaluwarsa.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return {
      status: "error",
      message: "Password belum dapat diperbarui. Minta tautan reset baru.",
    };
  }

  await supabase.auth.signOut();
  redirect("/login?reset=success");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
