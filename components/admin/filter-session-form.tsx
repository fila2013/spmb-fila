"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  adminFilterSession,
  clearFilterSessions,
  restoredFilterUrl,
  saveFilterSession,
  type AdminFilterPage,
} from "@/lib/admin/filter-session";

export function FilterSessionForm({
  page,
  children,
}: {
  page: AdminFilterPage;
  children: ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const config = adminFilterSession[page];

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    try {
      const current = new URLSearchParams(window.location.search);
      const target = restoredFilterUrl(
        config.path,
        current,
        window.sessionStorage.getItem(config.storageKey),
        config.fields,
      );
      if (target) {
        router.replace(target, { scroll: false });
        return;
      }

      // A filter supplied in the URL (including an explicit empty filter) wins
      // over an older value saved from another dashboard visit.
      if (config.fields.some((field) => current.has(field))) {
        saveFilterSession(window.sessionStorage, config.storageKey, new FormData(form), config.fields);
      }
    } catch {
      // Private browsing or a blocked Storage API must not break filtering.
    }
  }, [config, router]);

  function saveFilters() {
    if (!formRef.current) return;
    try {
      saveFilterSession(window.sessionStorage, config.storageKey, new FormData(formRef.current), config.fields);
    } catch {
      // The GET filter form still works when sessionStorage is unavailable.
    }
  }

  return (
    <form
      ref={formRef}
      method="get"
      action={config.path}
      onInput={saveFilters}
      onChange={saveFilters}
      onSubmit={saveFilters}
      className="rounded-2xl border border-emerald-950/10 bg-white p-5 sm:p-6"
    >
      {children}
    </form>
  );
}

export function FilterSessionReset({ page }: { page: AdminFilterPage }) {
  const { path, storageKey } = adminFilterSession[page];

  return (
    <Link
      href={path}
      onClick={() => {
        try {
          clearFilterSessions(window.sessionStorage, [storageKey]);
        } catch {
          // Navigation to the unfiltered page remains available.
        }
      }}
      className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
    >
      Reset
    </Link>
  );
}
