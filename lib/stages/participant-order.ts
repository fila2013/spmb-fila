import "server-only";

import type { CalonMurid, KontenTahap } from "@/generated/prisma/client";
import { StatusKeseluruhan, TahapKonten } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { announcementReachedStatuses } from "@/lib/stages/rules";

type ParticipantOrderCandidate = Pick<
  CalonMurid,
  "id" | "createdAt" | "jalurId" | "kategoriId" | "menungguFallbackJalurId" | "statusKeseluruhan"
>;
type BoundedContent = Pick<KontenTahap, "minParticipantOrder" | "maxParticipantOrder">;
type OperationalContentStage = typeof TahapKonten.ASSESSMENT | typeof TahapKonten.ANNOUNCEMENT;

export function matchesParticipantOrder(content: BoundedContent, order: number | null) {
  const { minParticipantOrder: min, maxParticipantOrder: max } = content;
  if (min === null && max === null) return true;
  if (order === null) return false;
  return (min === null || order >= min) && (max === null || order <= max);
}

export async function participantOrderForContent(child: ParticipantOrderCandidate) {
  const routeId = child.jalurId ?? child.menungguFallbackJalurId;
  if (!routeId || !child.kategoriId) return null;

  // Include the participant and all earlier records in the current route/category.
  // UUID breaks ties when multiple participants have the same created_at.
  return prisma.calonMurid.count({
    where: {
      kategoriId: child.kategoriId,
      OR: [
        { jalurId: routeId },
        { jalurId: null, menungguFallbackJalurId: routeId },
      ],
      AND: [{
        OR: [
          { createdAt: { lt: child.createdAt } },
          { createdAt: child.createdAt, id: { lte: child.id } },
        ],
      }],
    },
  });
}

export async function participantOrderForOperationalStage(
  child: ParticipantOrderCandidate,
  stage: OperationalContentStage,
) {
  const routeId = child.jalurId ?? child.menungguFallbackJalurId;
  if (!routeId) return null;

  const cohortStatuses = stage === TahapKonten.ASSESSMENT
    ? [StatusKeseluruhan.MENUNGGU_ASESMEN]
    : announcementReachedStatuses;
  if (!cohortStatuses.includes(child.statusKeseluruhan)) return null;

  // All categories in the current route share one chronological stage cohort.
  // Include this participant; UUID provides a stable tie-breaker for created_at.
  return prisma.calonMurid.count({
    where: {
      statusKeseluruhan: { in: cohortStatuses },
      OR: [
        { jalurId: routeId },
        { jalurId: null, menungguFallbackJalurId: routeId },
      ],
      AND: [{
        OR: [
          { createdAt: { lt: child.createdAt } },
          { createdAt: child.createdAt, id: { lte: child.id } },
        ],
      }],
    },
  });
}

export async function contentVisibleToParticipant<T extends BoundedContent>(
  content: T[],
  child: ParticipantOrderCandidate,
  stage?: OperationalContentStage,
): Promise<T[]> {
  if (!content.some((block) => block.minParticipantOrder !== null || block.maxParticipantOrder !== null)) {
    return content;
  }
  const order = stage
    ? await participantOrderForOperationalStage(child, stage)
    : await participantOrderForContent(child);
  return content.filter((block) => matchesParticipantOrder(block, order));
}
