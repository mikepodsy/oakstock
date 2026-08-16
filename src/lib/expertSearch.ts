// Search matching for the Superinvestors roster: a query hits on the investor's
// name, their fund, or their strategy, and tolerates small typos.

export interface SearchableManager {
  name: string;
  fund: string;
  strategy?: string | null;
}

// Levenshtein distance, bailing out as soon as it exceeds `max` — we only ever care
// about "is this within a typo or two", not the exact distance.
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      rowMin = Math.min(rowMin, curr[j]);
    }
    if (rowMin > max) return max + 1;
    prev = curr;
  }
  return prev[b.length];
}

// A term matches if it starts one of the haystack's words, appears inside it, or is
// a near-miss for one of its words — "perishing square" should still find Pershing
// Square. Short terms only ever match a word start, and never fuzzily: "lu" is a
// substring of "value" and one edit from a dozen other words, so anything looser
// turns a two-letter query into the whole roster.
function termMatches(term: string, haystack: string, words: string[]): boolean {
  if (words.some((w) => w.startsWith(term))) return true;
  if (term.length < 4) return false;
  if (haystack.includes(term)) return true;
  const tolerance = term.length >= 7 ? 2 : 1;
  return words.some((w) => w.length >= 3 && editDistance(term, w, tolerance) <= tolerance);
}

/** Split a raw query into the terms `matchesQuery` expects. */
export function searchTerms(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * True when every term matches somewhere in the manager's name / fund / strategy,
 * so multi-word queries narrow the list rather than widening it.
 */
export function matchesQuery(manager: SearchableManager, terms: string[]): boolean {
  const haystack = `${manager.name} ${manager.fund} ${manager.strategy ?? ""}`.toLowerCase();
  const words = haystack.split(/[^a-z0-9]+/).filter(Boolean);
  return terms.every((t) => termMatches(t, haystack, words));
}
