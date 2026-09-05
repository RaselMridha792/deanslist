"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * The admin error boundary.
 *
 * It sits at src/app/admin rather than inside the (dashboard) group on purpose:
 * a throw in the dashboard layout itself renders this screen INSTEAD of the
 * shell, so there is no sidebar and no themed wrapper around it. That is why
 * the `admin` class is on the root element here. Without it the boundary paints
 * body's `bg-ground text-ink` and a failure inside a near-black dashboard hands
 * back a full page of paper.
 *
 * error.message is deliberately not rendered. It is a server-side string and
 * routinely carries the failing query, a table name or a connection target.
 * The digest is the id Next.js also writes to the server log, so it is the one
 * value that ties this screen to the stack trace without leaking it.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] route error", error.digest ?? "no digest");
  }, [error]);

  return (
    <div className="admin flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl">
        <p className="eyebrow">Dashboard</p>
        <h1 className="mt-2 font-display text-3xl tracking-wide">
          Something went wrong
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-admin-muted">
          This screen failed to load. Nothing you were looking at has been
          changed. Try again, and if it fails a second time the details are in
          the server log.
        </p>

        {error.digest && (
          <div className="notice mt-6">
            <p className="eyebrow">Error id</p>
            <p className="mt-1 break-all font-mono text-sm text-admin-text">
              {error.digest}
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-admin-faint">
              Quote this id when you report the failure. It matches the entry in
              the server log.
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="btn btn-primary">
            Try again
          </button>
          <Link href="/admin" className="btn btn-outline">
            Back to the dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
