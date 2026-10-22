import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRole = vi.hoisted(() => vi.fn());
const openInvitation = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ requireRole }));
vi.mock("@/lib/admission/service", () => ({ openWhatsappInvitation: openInvitation }));

import { POST } from "@/app/api/calon-murid/[id]/status-wa/join/route";
import { PATCH } from "@/app/api/admin/peserta/[id]/status-wa/route";
import { UserRole } from "@/generated/prisma/enums";

const params = Promise.resolve({ id: "10000000-0000-4000-8000-000000000001" });

describe("API link grup pusat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({ userId: "wali-1" });
  });

  it("meneruskan URL yang diklik untuk diperiksa terhadap konten terbaru", async () => {
    const response = await POST(new Request("https://example.test/join", { method: "POST", body: JSON.stringify({ inviteUrl: "https://chat.whatsapp.com/Selected_Group" }) }), { params });
    expect(response.status).toBe(200);
    expect(requireRole).toHaveBeenCalledWith(UserRole.WALI_MURID);
    expect(openInvitation).toHaveBeenCalledWith((await params).id, "wali-1", "https://chat.whatsapp.com/Selected_Group");
  });

  it("menolak URL tidak resmi sebelum memanggil service", async () => {
    const response = await POST(new Request("https://example.test/join", { method: "POST", body: JSON.stringify({ inviteUrl: "javascript:alert(1)" }) }), { params });
    expect(response.status).toBe(422);
    expect(openInvitation).not.toHaveBeenCalled();
  });

  it("menonaktifkan pengaturan link manual per peserta dengan petunjuk CMS", async () => {
    const response = await PATCH(new Request("https://example.test/admin", { method: "PATCH" }), { params });
    expect(requireRole).toHaveBeenCalledWith(UserRole.ADMIN);
    expect(response.status).toBe(410);
    expect((await response.json()).error.code).toBe("INVITATION_MANAGED_BY_CONTENT");
    expect(openInvitation).not.toHaveBeenCalled();
  });
});
