"use server";

import { revalidatePath } from "next/cache";

import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import type { StageActionState } from "@/lib/stages/action-state";
import { FallbackError } from "@/lib/fallback/errors";
import { reprocessFallbackQueue } from "@/lib/fallback/service";
import { stageIdSchema } from "@/lib/stages/schemas";

export async function reprocessFallbackQueueAction(
  _state: StageActionState,
  formData: FormData,
): Promise<StageActionState> {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const id = stageIdSchema.parse(formData.get("id"));
    const result = await reprocessFallbackQueue(id, admin.userId);
    revalidatePath("/admin/jalur");
    revalidatePath("/admin/peserta");
    return {
      status: "success",
      message: `${result.processed} peserta diproses; ${result.remaining} masih menunggu.`,
    };
  } catch (error) {
    if (error instanceof FallbackError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: "Antrian belum dapat diproses ulang." };
  }
}
