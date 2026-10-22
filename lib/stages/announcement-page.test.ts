import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadAnnouncement = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/navigation", () => ({ requireWaliPage: async () => ({ userId: "wali-1" }) }));
vi.mock("@/lib/stages/service", () => ({ getAnnouncementForWali: loadAnnouncement }));
vi.mock("@/components/stages/final-route-choice-form", () => ({ FinalRouteChoiceForm: () => null }));

import AnnouncementPage from "@/app/anak/[id]/pengumuman/page";

const base = {
  child: { id: "child-1", namaAnak: "Randa Admiral", jalur: "Reguler", kategori: "Umum" },
  released: false, waitingQuota: false, fallbackJalur: null, tanggalRilis: "2026-10-24", statusAkhir: null,
  letter: null, canContinueToAdmission: false, finalRouteChoice: null,
  content: [{ id: "info-1", judul: "Jadwal pengumuman", tanggal: "2026-10-24", isiTeks: "Silakan cek hasil pada tanggal tersebut.", gambarUrl: "https://example.com/jadwal.webp", youtubeVideoId: null, urutanLayout: 0 }],
};

describe("tampilan pengumuman wali", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sebelum rilis menampilkan informasi, gambar, dan Google Calendar tanpa alert kuning", async () => {
    loadAnnouncement.mockResolvedValue(base);
    const html = renderToStaticMarkup(await AnnouncementPage({ params: Promise.resolve({ id: "child-1" }) }));
    expect(html).toContain("Silakan cek hasil pada tanggal tersebut.");
    expect(html).toContain('src="https://example.com/jadwal.webp"');
    expect(html).toContain("Tambahkan ke Google Calendar");
    expect(html).toContain("dates=20261024%2F20261025");
    expect(html).not.toContain("Pengumuman belum dirilis");
    expect(html).not.toContain("Surat Pengumuman Hasil Seleksi");
  });

  it("setelah rilis menampilkan surat teks dan tombol DU untuk peserta diterima", async () => {
    loadAnnouncement.mockResolvedValue({ ...base, released: true, statusAkhir: "DITERIMA", letter: "Yth. Wali Randa Admiral, DITERIMA di Reguler.", canContinueToAdmission: true, content: [] });
    const html = renderToStaticMarkup(await AnnouncementPage({ params: Promise.resolve({ id: "child-1" }) }));
    expect(html).toContain("Yth. Wali Randa Admiral, DITERIMA di Reguler.");
    expect(html).toContain('href="/anak/child-1/daftar-ulang"');
    expect(html).not.toContain("Tambahkan ke Google Calendar");
  });

  it("surat penolakan tidak menawarkan DU dan meng-escape teks HTML", async () => {
    loadAnnouncement.mockResolvedValue({ ...base, released: true, statusAkhir: "TIDAK_DITERIMA", letter: "Tidak diterima. <script>alert(1)</script>", content: [] });
    const html = renderToStaticMarkup(await AnnouncementPage({ params: Promise.resolve({ id: "child-1" }) }));
    expect(html).toContain("TIDAK DITERIMA");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('href="/anak/child-1/daftar-ulang"');
  });
});
