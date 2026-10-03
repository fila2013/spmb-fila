"use client";

import { logoutAction } from "@/app/(auth)/actions";
import { clearFilterSessions } from "@/lib/admin/filter-session";

export function AdminLogoutForm() {
  return (
    <form
      action={logoutAction}
      onSubmit={() => {
        try {
          clearFilterSessions(window.sessionStorage);
        } catch {
          // Logging out must still work if browser storage is unavailable.
        }
      }}
      className="mt-2"
    >
      <button className="text-sm font-semibold text-red-700 hover:underline">Keluar</button>
    </form>
  );
}
