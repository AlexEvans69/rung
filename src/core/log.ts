function debugEnabled(): boolean {
  try {
    return localStorage.getItem("serpCounterDebug") === "1";
  } catch {
    return false;
  }
}

export const isDebugEnabled = debugEnabled;

/** Silent unless `localStorage.serpCounterDebug = "1"` is set on the page. */
export function debug(...args: unknown[]): void {
  if (debugEnabled()) console.debug("[SERP Counter]", ...args);
}
