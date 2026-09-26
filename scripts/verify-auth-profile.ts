import { randomBytes, randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";

import { PrismaClient } from "../generated/prisma/client";
import { UserRole } from "../generated/prisma/enums";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabaseKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;

if (!supabaseUrl || !publishableKey || !supabaseKey || !databaseUrl) {
  throw new Error("Environment Supabase dan database belum lengkap.");
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const marker = randomUUID();
const email = `phase2-${marker}@example.invalid`;
const pendingEmail = `phase2-pending-${marker}@example.invalid`;
const password = randomBytes(24).toString("base64url");
let authUserId: string | undefined;
let pendingAuthUserId: string | undefined;

try {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "admin" },
  });

  if (error || !data.user) {
    throw new Error(`Gagal membuat akun uji Auth: ${error?.message ?? "unknown"}`);
  }

  authUserId = data.user.id;
  const profile = await prisma.user.findUnique({
    where: { supabaseAuthUserId: authUserId },
  });

  if (!profile) {
    throw new Error("Trigger tidak membuat profile users.");
  }

  if (
    profile.role !== UserRole.WALI_MURID ||
    !profile.statusAktif ||
    !profile.emailVerifiedAt
  ) {
    throw new Error("Default role/status profile tidak aman.");
  }

  const publicClient = createClient(
    supabaseUrl,
    publishableKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data: loginData, error: loginError } =
    await publicClient.auth.signInWithPassword({ email, password });
  if (loginError || loginData.user?.id !== authUserId) {
    throw new Error("Login password melalui publishable client gagal.");
  }
  await publicClient.auth.signOut();

  const pendingCreation = await supabase.auth.admin.createUser({
    email: pendingEmail,
    password,
    email_confirm: false,
  });
  if (pendingCreation.error || !pendingCreation.data.user) {
    throw new Error(
      `Gagal membuat akun pending uji Auth: ${pendingCreation.error?.message ?? "unknown"}`,
    );
  }
  pendingAuthUserId = pendingCreation.data.user.id;

  const pendingProfile = await prisma.user.findUnique({
    where: { supabaseAuthUserId: pendingAuthUserId },
  });
  if (
    !pendingProfile ||
    pendingProfile.statusAktif ||
    pendingProfile.emailVerifiedAt
  ) {
    throw new Error("Akun belum terverifikasi tidak dibuat sebagai pending.");
  }

  const blockedLogin = await publicClient.auth.signInWithPassword({
    email: pendingEmail,
    password,
  });
  if (!blockedLogin.error || blockedLogin.error.code !== "email_not_confirmed") {
    throw new Error("Akun pending tidak diblokir sebelum verifikasi email.");
  }

  const confirmation = await supabase.auth.admin.updateUserById(
    pendingAuthUserId,
    { email_confirm: true },
  );
  if (confirmation.error) {
    throw new Error(`Konfirmasi akun uji gagal: ${confirmation.error.message}`);
  }

  const activatedProfile = await prisma.user.findUnique({
    where: { supabaseAuthUserId: pendingAuthUserId },
  });
  if (!activatedProfile?.statusAktif || !activatedProfile.emailVerifiedAt) {
    throw new Error("Konfirmasi email tidak mengaktifkan profile pending.");
  }

  const activatedLogin = await publicClient.auth.signInWithPassword({
    email: pendingEmail,
    password,
  });
  if (
    activatedLogin.error ||
    activatedLogin.data.user?.id !== pendingAuthUserId
  ) {
    throw new Error("Login akun setelah konfirmasi email gagal.");
  }
  await publicClient.auth.signOut();

  console.log("Auth profile integration: OK");
} finally {
  if (authUserId) {
    await prisma.user.deleteMany({ where: { supabaseAuthUserId: authUserId } });
    await supabase.auth.admin.deleteUser(authUserId);
  }
  if (pendingAuthUserId) {
    await prisma.user.deleteMany({
      where: { supabaseAuthUserId: pendingAuthUserId },
    });
    await supabase.auth.admin.deleteUser(pendingAuthUserId);
  }

  await prisma.$disconnect();
}
