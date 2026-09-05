"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className="mt-3 text-[10px] font-semibold uppercase tracking-[.14em] text-admin-faint transition-colors duration-200 ease-dl hover:text-brand-onDark disabled:opacity-50"
    >
      {busy ? "Signing out" : "Sign out"}
    </button>
  );
}
