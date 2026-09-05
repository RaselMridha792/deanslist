import Link from "next/link";

/**
 * The admin 404, and the target of every notFound() call under /admin.
 *
 * Like error.tsx it renders in place of the dashboard shell, not inside it, so
 * it carries the `admin` class itself and provides its own way back. A missing
 * screen with no sidebar and no link is a dead end.
 */
export default function AdminNotFound() {
  return (
    <div className="admin flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl">
        <p className="eyebrow">Dashboard</p>
        <h1 className="mt-2 font-display text-3xl tracking-wide">
          This screen does not exist
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-admin-muted">
          The address you opened is not part of the dashboard. It may have been
          renamed, or the record it pointed to was deleted.
        </p>

        <div className="mt-8">
          <Link href="/admin" className="btn btn-outline">
            Back to the dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
