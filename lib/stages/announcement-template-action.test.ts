import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRole = vi.hoisted(() => vi.fn());
const save = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/auth/session", () => ({ requireRole }));
vi.mock("@/lib/stages/announcement-template-service", () => ({ saveAnnouncementTemplates: save }));
vi.mock("@/lib/stages/service", () => ({}));

import { UserRole } from "@/generated/prisma/enums";
import { saveAnnouncementTemplatesAction } from "@/app/admin/(stages)/actions";
import { defaultAnnouncementTemplates } from "@/lib/stages/announcement-letter";

function form() {
  const data = new FormData();
  data.set("diterima", defaultAnnouncementTemplates.diterima);
  data.set("tidakDiterima", defaultAnnouncementTemplates.tidakDiterima);
  return data;
}

describe("server action template surat", () => {
  beforeEach(() => vi.clearAllMocks());

  it("memvalidasi role Admin, menyimpan, dan mengembalikan nilai terbaru untuk state form", async () => {
    requireRole.mockResolvedValue({ userId: "admin-1" });
    save.mockResolvedValue(defaultAnnouncementTemplates);
    const result = await saveAnnouncementTemplatesAction({ status: "idle" }, form());
    expect(requireRole).toHaveBeenCalledWith(UserRole.ADMIN);
    expect(save).toHaveBeenCalledWith(defaultAnnouncementTemplates, "admin-1");
    expect(result).toMatchObject({ status: "success", templates: defaultAnnouncementTemplates });
    expect(revalidatePath).toHaveBeenCalledWith("/anak/[id]/pengumuman", "page");
  });

  it("tidak menyimpan ketika otorisasi gagal", async () => {
    requireRole.mockRejectedValue(new Error("forbidden"));
    expect((await saveAnnouncementTemplatesAction({ status: "idle" }, form())).status).toBe("error");
    expect(save).not.toHaveBeenCalled();
  });
});
