import { beforeEach, describe, expect, it, vi } from "vitest";

const count = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { calonMurid: { count } } }));

import {
  contentVisibleToParticipant,
  matchesParticipantOrder,
  participantOrderForContent,
} from "@/lib/stages/participant-order";

const child = {
  id: "00000000-0000-4000-8000-000000000002",
  createdAt: new Date("2026-10-01T02:00:00.000Z"),
  jalurId: "00000000-0000-4000-8000-000000000010",
  kategoriId: "00000000-0000-4000-8000-000000000020",
  menungguFallbackJalurId: null,
};

describe("rentang urutan peserta untuk konten tahap", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mempertahankan blok lama tanpa batas tanpa menghitung urutan", async () => {
    const blocks = [{ id: "umum", minParticipantOrder: null, maxParticipantOrder: null }];
    expect(await contentVisibleToParticipant(blocks, child)).toBe(blocks);
    expect(count).not.toHaveBeenCalled();
  });

  it("menggunakan batas inklusif dan mendukung batas satu sisi", () => {
    expect(matchesParticipantOrder({ minParticipantOrder: 1, maxParticipantOrder: 50 }, 50)).toBe(true);
    expect(matchesParticipantOrder({ minParticipantOrder: 1, maxParticipantOrder: 50 }, 51)).toBe(false);
    expect(matchesParticipantOrder({ minParticipantOrder: null, maxParticipantOrder: 50 }, 1)).toBe(true);
    expect(matchesParticipantOrder({ minParticipantOrder: 51, maxParticipantOrder: null }, 51)).toBe(true);
    expect(matchesParticipantOrder({ minParticipantOrder: 51, maxParticipantOrder: null }, 50)).toBe(false);
    expect(matchesParticipantOrder({ minParticipantOrder: 1, maxParticipantOrder: 50 }, null)).toBe(false);
    expect(matchesParticipantOrder({ minParticipantOrder: null, maxParticipantOrder: null }, null)).toBe(true);
  });

  it("menghitung urutan berdasarkan jalur, kategori, waktu, lalu ID", async () => {
    count.mockResolvedValue(2);
    expect(await participantOrderForContent(child)).toBe(2);
    expect(count).toHaveBeenCalledWith({
      where: {
        kategoriId: child.kategoriId,
        OR: [
          { jalurId: child.jalurId },
          { jalurId: null, menungguFallbackJalurId: child.jalurId },
        ],
        AND: [{ OR: [
          { createdAt: { lt: child.createdAt } },
          { createdAt: child.createdAt, id: { lte: child.id } },
        ] }],
      },
    });
  });

  it("memakai jalur tujuan saat peserta sedang menunggu fallback", async () => {
    count.mockResolvedValue(4);
    expect(await participantOrderForContent({ ...child, jalurId: null, menungguFallbackJalurId: child.jalurId })).toBe(4);
    expect(count.mock.calls[0][0].where.OR[0]).toEqual({ jalurId: child.jalurId });
  });

  it("menyembunyikan blok di luar rentang tetapi tetap menampilkan blok umum", async () => {
    count.mockResolvedValue(101);
    const blocks = [
      { id: "awal", minParticipantOrder: 1, maxParticipantOrder: 50 },
      { id: "lanjutan", minParticipantOrder: 51, maxParticipantOrder: null },
      { id: "semua", minParticipantOrder: null, maxParticipantOrder: null },
    ];
    expect((await contentVisibleToParticipant(blocks, child)).map((block) => block.id))
      .toEqual(["lanjutan", "semua"]);
    expect(count).toHaveBeenCalledOnce();
  });

  it("tanpa jalur atau kategori hanya menampilkan blok tanpa batas", async () => {
    const blocks = [
      { id: "terbatas", minParticipantOrder: 1, maxParticipantOrder: 50 },
      { id: "umum", minParticipantOrder: null, maxParticipantOrder: null },
    ];
    expect((await contentVisibleToParticipant(blocks, { ...child, kategoriId: null })).map((block) => block.id))
      .toEqual(["umum"]);
    expect(count).not.toHaveBeenCalled();
  });
});
