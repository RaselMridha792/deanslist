/**
 * Runs once, when the server starts.
 *
 * Its whole job is to validate the environment before the server takes a
 * request. Next loads modules lazily, so without this a container missing
 * AUTH_SECRET would start, report itself running, and fail on the first real
 * request — which in production is a visitor. Doing it here moves that failure
 * to boot, where `docker compose up` shows it.
 *
 * The check lives in instrumentation-node.ts and exits the process on failure,
 * because a throw from this hook alone is logged and ignored. See that file.
 * Loaded only in the Node runtime; the edge runtime imports the same env
 * module from middleware and needs no second copy.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertEnvironment } = await import("./instrumentation-node");
    await assertEnvironment();
  }
}
