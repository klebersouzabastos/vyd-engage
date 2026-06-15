// Recovery from stale lazy-loaded chunks after a deploy.
//
// When a new build is published, Vite asset hashes change and the old chunk
// files are removed from the server. A tab opened before the deploy still
// references the old hash, so its dynamic import 404s with "Failed to fetch
// dynamically imported module". The fix is to reload the page once so the
// browser fetches the fresh index.html + chunks. A short time-based guard
// prevents an infinite reload loop when the failure is NOT deploy-related
// (e.g. the user is genuinely offline).

const LAST_RELOAD_KEY = "vyd:last-chunk-reload";
const RELOAD_COOLDOWN_MS = 10_000;

export function isChunkLoadError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  return (
    /failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /importing a module script failed/i.test(message) || // Safari wording
    message.includes("ChunkLoadError")
  );
}

/**
 * Reloads the page once to recover from a stale chunk. Returns `true` if a
 * reload was triggered, or `false` if it was suppressed by the cooldown guard
 * (meaning the fresh assets still don't resolve, so the caller should surface
 * an error/manual-retry UI instead of looping).
 */
export function reloadForChunkError(): boolean {
  try {
    const now = Date.now();
    const last = Number(sessionStorage.getItem(LAST_RELOAD_KEY) || 0);
    if (now - last < RELOAD_COOLDOWN_MS) {
      return false;
    }
    sessionStorage.setItem(LAST_RELOAD_KEY, String(now));
  } catch {
    // sessionStorage unavailable (private mode / blocked) — reload anyway,
    // accepting a small loop risk over leaving the user stuck on a blank error.
  }
  window.location.reload();
  return true;
}
