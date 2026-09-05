"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: fd.get("email"), password: fd.get("password") }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Login failed");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="admin flex min-h-screen items-center justify-center px-5">
      {/*
        method="post" is not decoration. onSubmit calls preventDefault, so the
        browser never submits this form while the page is hydrated - but if the
        bundle fails or the click lands first, the DEFAULT submit runs, and a
        form with no method is a GET. That puts the password in the address bar,
        in history, and in the access log of whatever it hits. POST keeps it in
        the body, and /api/auth/login answers a form post with a 4xx rather than
        a redirect loop.
      */}
      <form
        onSubmit={onSubmit}
        method="post"
        action="/api/auth/login"
        className="card w-full max-w-sm p-8"
      >
        <p className="font-display text-xl tracking-[0.2em] text-brand-onDark">DEAN&apos;S LIST</p>
        <h1 className="mt-2 text-lg font-semibold">Admin sign in</h1>

        <div className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required className="field" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required className="field" />
          </div>
        </div>

        {error && <p className="error-text mt-4">{error}</p>}

        <button type="submit" disabled={loading} className="btn btn-primary mt-6 w-full disabled:opacity-50">
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
