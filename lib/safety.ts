// SAFETY RULE: nothing may delete or truncate data unless it has first proved it targets the throwaway database.
// The throwaway database is exactly `guardrail_e2e` on this computer (localhost / 127.0.0.1). Never Neon.

const THROWAWAY_DB = "guardrail_e2e";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function assertThrowaway(databaseUrl: string | undefined): void {
  let url: URL;
  try {
    url = new URL(databaseUrl ?? "");
  } catch {
    throw new Error(
      "Refusing: DATABASE_URL is missing or not a URL, so it can't be proved to be the throwaway copy.",
    );
  }
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!LOCAL_HOSTS.has(url.hostname) || dbName !== THROWAWAY_DB) {
    throw new Error(
      `Refusing: this would delete data in "${dbName}" on "${url.hostname}". ` +
        `Only the throwaway database "${THROWAWAY_DB}" on localhost may be wiped.`,
    );
  }
}
