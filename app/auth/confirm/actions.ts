"use server";

import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { z } from "zod";

import { ensureUserProfile } from "@/lib/auth/profile";
import { confirmationDestination } from "@/lib/auth/confirmation";
import { createClient } from "@/lib/supabase/server";

const confirmationSchema = z.object({
  tokenHash: z.string().min(1).max(2048),
  type: z.enum([
    "email",
    "invite",
    "magiclink",
    "recovery",
    "signup",
    "email_change",
  ]),
  next: z.string().max(2048).optional(),
});

export async function confirmEmailAction(formData: FormData) {
  const parsed = confirmationSchema.safeParse({
    tokenHash: formData.get("tokenHash"),
    type: formData.get("type"),
    next: formData.get("next"),
  });

  if (!parsed.success) {
    redirect("/login?auth=invalid");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: parsed.data.tokenHash,
    type: parsed.data.type as EmailOtpType,
  });

  if (error || !data.user?.email) {
    redirect(
      error?.code === "otp_expired"
        ? "/login?auth=otp_expired"
        : "/login?auth=invalid",
    );
  }

  await ensureUserProfile({ id: data.user.id, email: data.user.email });
  if (parsed.data.type === "recovery") {
    redirect(confirmationDestination(parsed.data.type, parsed.data.next));
  }

  await supabase.auth.signOut();
  redirect("/login?auth=confirmed");
}
