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
const password = randomBytes(24).toString("base64url");
let authUserId: string | undefined;

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

  if (profile.role !== UserRole.WALI_MURID || !profile.statusAktif) {
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

  console.log("Auth profile integration: OK");
} finally {
  if (authUserId) {
    await prisma.user.deleteMany({ where: { supabaseAuthUserId: authUserId } });
    await supabase.auth.admin.deleteUser(authUserId);
  }

  await prisma.$disconnect();
}
