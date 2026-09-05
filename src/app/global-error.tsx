"use client";

import { useEffect } from "react";

/**
 * The last boundary.
 *
 * src/app/admin/error.tsx catches a throw inside an admin route. Nothing
 * catches a throw in the ROOT layout, or one inside an error boundary's own
 * render, and without this file Next.js falls back to its built-in screen:
 * black on white, in a product where half the surface is near-black.
 *
 * It REPLACES the root layout, so it has to render <html> and <body> itself,
 * and it cannot rely on globals.css having loaded or on next/font having run.
 * That is why every value here is inline and literal rather than a token: at
 * the point this renders, the thing that defines the tokens may be what broke.
 *
 * error.message is not shown, for the same reason it is withheld in the admin
 * boundary: it is a server string and can carry a query, a table name or a
 * connection target. The digest is the id Next.js also writes to the server
 * log, which is what ties this screen to the trace.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] global error", error.digest ?? "no digest");
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          background: "#201e1d",
          color: "#f3f2f2",
          fontFamily: "Archivo, system-ui, sans-serif",
        }}
      >
        <main style={{ maxWidth: "42rem", padding: "0 clamp(20px,4vw,56px)" }}>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: ".16em",
              textTransform: "uppercase",
              color: "#ff5a4a",
            }}
          >
            Error
          </p>
          <h1
            style={{
              margin: "20px 0 0",
              fontSize: "clamp(32px,5vw,64px)",
              lineHeight: 0.95,
              letterSpacing: "-.04em",
              fontWeight: 800,
              textTransform: "uppercase",
            }}
          >
            The site failed to load.
          </h1>
          <p style={{ margin: "20px 0 0", fontSize: 17, lineHeight: 1.5, opacity: 0.85 }}>
            This is on our side, not yours. Nothing you submitted has been lost.
          </p>

          {error.digest && (
            <p
              style={{
                margin: "24px 0 0",
                borderLeft: "4px solid #d40000",
                padding: "12px 16px",
                background: "rgba(243,242,242,.06)",
                fontFamily: "ui-monospace, monospace",
                fontSize: 13,
              }}
            >
              {error.digest}
            </p>
          )}

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 32,
              display: "inline-flex",
              alignItems: "center",
              border: "2px solid #d40000",
              background: "#d40000",
              color: "#fff",
              padding: "14px 24px",
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
