export function normalizeWhatsappInviteUrl(value: string) {
  if (value.trim().length > 2_048) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.hostname !== "chat.whatsapp.com" || url.port || url.username || url.password || !/^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) return null;
    return `${url.origin}${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return null;
  }
}

export type WhatsappTextPart = { text: string; url: string | null };

export function whatsappTextParts(text: string): WhatsappTextPart[] {
  const parts: WhatsappTextPart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(/https:\/\/[^\s<>"'“”‘’]+/gi)) {
    const candidate = match[0].replace(/[.,;:!?)\]}]+$/, "");
    const url = normalizeWhatsappInviteUrl(candidate);
    if (!url) continue;
    const start = match.index;
    if (start > cursor) parts.push({ text: text.slice(cursor, start), url: null });
    parts.push({ text: candidate, url });
    cursor = start + candidate.length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), url: null });
  return parts;
}

export function whatsappUrlsFromContent(content: ReadonlyArray<{ isiTeks: string | null }>) {
  return [...new Set(content.flatMap((block) => whatsappTextParts(block.isiTeks ?? "").flatMap((part) => part.url ? [part.url] : [])))];
}
