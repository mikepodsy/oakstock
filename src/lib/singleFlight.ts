// Single-flight: wrap an async function so that concurrent calls share one
// in-flight promise instead of each starting their own. Once the in-flight call
// settles, the next call starts fresh.
//
// Used to coalesce Questrade token refreshes: the refresh token is single-use,
// so two concurrent refreshes invalidate each other. Funnelling all concurrent
// callers through one refresh avoids that stampede.
export function singleFlight<T>(fn: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null;
  return () => {
    if (inFlight) return inFlight;
    const p = fn().finally(() => {
      // Only clear if we're still the active call (guards against a race where a
      // new call started after this one settled).
      if (inFlight === p) inFlight = null;
    });
    inFlight = p;
    return p;
  };
}
