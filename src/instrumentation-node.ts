/**
 * The Node half of instrumentation.ts, kept in its own file so the edge build
 * never sees `process.exit`.
 *
 * Why the exit is explicit: an error thrown from the instrumentation hook is
 * NOT fatal in Next. It is logged as an unhandled rejection and the server goes
 * on listening. Measured, not assumed — started without AUTH_SECRET, the server
 * printed exactly the right message ("AUTH_SECRET: Required") and then kept
 * accepting connections on its port, ready to answer every visitor with an
 * error while Docker reported the container as running.
 *
 * So the failure is made final here. The container exits non-zero, Docker
 * shows it as stopped rather than up, and `docker compose logs app` has the
 * variable that is wrong on its last line.
 */
export async function assertEnvironment(): Promise<void> {
  try {
    await import("./lib/env");
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    console.error(
      "Refusing to start: the environment above is invalid. Fix .env and restart the container.",
    );
    process.exit(1);
  }
}
