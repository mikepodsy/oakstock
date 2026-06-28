import { createServerSupabaseClient } from "@/lib/supabase";
import { questradeSymbolCache } from "@/lib/cache";
import { singleFlight } from "@/lib/singleFlight";

// Questrade OAuth + market-data helper.
//
// Auth model: Questrade refresh tokens are SINGLE-USE. Every exchange returns a
// brand-new refresh token plus a ~30-min access token and an account-specific
// api_server. We persist the rotating refresh token (and cache the access token)
// in the single-row `questrade_auth` table so auth survives across serverless
// invocations and the read-only Vercel filesystem.
//
// Bootstrap: if the table has no row yet, we seed it from QUESTRADE_REFRESH_TOKEN
// in the environment. After the first refresh the DB is the source of truth.

const LOGIN_HOST = "https://login.questrade.com";
// Refresh a little before the real expiry so in-flight requests don't race the cutoff.
const EXPIRY_MARGIN_MS = 60_000;

interface AuthRow {
  refresh_token: string;
  access_token: string | null;
  api_server: string | null;
  expires_at: string | null;
}

interface QuestradeAuth {
  accessToken: string;
  apiServer: string; // normalized without trailing slash
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  api_server: string;
  expires_in: number;
  token_type: string;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

// Cap how long we wait on any Questrade HTTP call. Without this, a stalled
// endpoint (e.g. the OAuth token host hanging) leaves the request — and the
// chart waiting on it — hung indefinitely. With it, the call fails fast and the
// caller can surface an error instead of spinning forever.
const REQUEST_TIMEOUT_MS = 12_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      const host = (() => {
        try {
          return new URL(url).host;
        } catch {
          return url;
        }
      })();
      throw new Error(
        `Questrade request to ${host} timed out after ${REQUEST_TIMEOUT_MS}ms`
      );
    }
    throw err;
  }
}

async function loadAuthRow(): Promise<AuthRow> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("questrade_auth")
    .select("refresh_token, access_token, api_server, expires_at")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw new Error(`questrade_auth read failed: ${error.message}`);
  }

  if (data) return data as AuthRow;

  // Bootstrap from env on first run.
  const seed = process.env.QUESTRADE_REFRESH_TOKEN;
  if (!seed) {
    throw new Error(
      "No questrade_auth row and QUESTRADE_REFRESH_TOKEN is not set — cannot bootstrap."
    );
  }

  const { error: insertError } = await supabase
    .from("questrade_auth")
    .insert({ id: 1, refresh_token: seed });

  if (insertError) {
    throw new Error(`questrade_auth bootstrap insert failed: ${insertError.message}`);
  }

  return { refresh_token: seed, access_token: null, api_server: null, expires_at: null };
}

async function refreshAccessToken(refreshToken: string): Promise<QuestradeAuth> {
  const res = await fetchWithTimeout(
    `${LOGIN_HOST}/oauth2/token?grant_type=refresh_token&refresh_token=${refreshToken}`,
    { method: "GET" }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Questrade token refresh failed (${res.status}): ${body}`);
  }

  const token = (await res.json()) as TokenResponse;
  const apiServer = stripTrailingSlash(token.api_server);
  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

  // Persist the rotated refresh token + cached access token immediately.
  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("questrade_auth")
    .update({
      refresh_token: token.refresh_token,
      access_token: token.access_token,
      api_server: apiServer,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) {
    // The token already rotated on Questrade's side; if we fail to save it the
    // old one is dead. Surface loudly rather than silently losing access.
    throw new Error(`Failed to persist rotated Questrade token: ${error.message}`);
  }

  return { accessToken: token.access_token, apiServer };
}

// Coalesce concurrent refreshes. Questrade refresh tokens are SINGLE-USE, so if
// several parallel requests (e.g. the Mag 7 alerts route fetching 7 tickers at
// once) each kick off their own refresh, the first rotates the token and the
// rest fail with "Access token is invalid". Funnelling every concurrent caller
// through one in-flight refresh fixes that stampede.
const refreshAuth = singleFlight(async (): Promise<QuestradeAuth> => {
  const row = await loadAuthRow();
  return refreshAccessToken(row.refresh_token);
});

/**
 * Returns a valid access token + api_server. Reuses the cached one until it is
 * within EXPIRY_MARGIN_MS of expiry, otherwise refreshes (rotating the
 * single-use refresh token). Pass forceRefresh to bypass the cache — used when
 * Questrade rejects a token that our clock still considers valid.
 */
export async function getQuestradeAuth(forceRefresh = false): Promise<QuestradeAuth> {
  if (!forceRefresh) {
    const row = await loadAuthRow();
    if (
      row.access_token &&
      row.api_server &&
      row.expires_at &&
      new Date(row.expires_at).getTime() - Date.now() > EXPIRY_MARGIN_MS
    ) {
      return { accessToken: row.access_token, apiServer: stripTrailingSlash(row.api_server) };
    }
  }

  return refreshAuth();
}

/** Authenticated GET against the account's Questrade api_server. */
export async function questradeGet<T>(path: string): Promise<T> {
  let auth = await getQuestradeAuth();
  let res = await fetchWithTimeout(`${auth.apiServer}${path}`, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  });

  // Questrade can invalidate an access token before our stored expiry (e.g. when
  // a newer token is issued). On 401, force a refresh once and retry.
  if (res.status === 401) {
    auth = await getQuestradeAuth(true);
    res = await fetchWithTimeout(`${auth.apiServer}${path}`, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    });
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Questrade GET ${path} failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<T>;
}

/** Authenticated POST against the account's Questrade api_server (JSON body). */
export async function questradePost<T>(path: string, body: unknown): Promise<T> {
  const send = (auth: QuestradeAuth) =>
    fetchWithTimeout(`${auth.apiServer}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

  let auth = await getQuestradeAuth();
  let res = await send(auth);

  // Same premature-401 handling as questradeGet: force a refresh once and retry.
  if (res.status === 401) {
    auth = await getQuestradeAuth(true);
    res = await send(auth);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Questrade POST ${path} failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

interface SymbolSearchResponse {
  symbols: Array<{ symbolId: number; symbol: string; isTradable: boolean }>;
}

/**
 * Resolves a ticker to its Questrade symbolId, preferring an exact symbol match.
 * Cached for 24h (symbolIds rarely change). Returns null when nothing matches.
 */
export async function resolveSymbolId(ticker: string): Promise<number | null> {
  const cacheKey = ticker.toUpperCase();
  const cached = questradeSymbolCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const data = await questradeGet<SymbolSearchResponse>(
    `/v1/symbols/search?prefix=${encodeURIComponent(ticker)}`
  );

  const match =
    data.symbols.find((s) => s.symbol.toUpperCase() === cacheKey) ??
    data.symbols[0];
  const symbolId = match ? match.symbolId : null;

  questradeSymbolCache.set(cacheKey, symbolId);
  return symbolId;
}
