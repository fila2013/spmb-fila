"use client";

import { useEffect, useState } from "react";

export function useHoldExpired(expiresAt: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  return new Date(expiresAt).getTime() <= now;
}
