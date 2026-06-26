import { createServerSupabaseClient } from "@/lib/supabase";

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
  const res = await fetch(
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

/**
 * Returns a valid access token + api_server. Reuses the cached one until it is
 * within EXPIRY_MARGIN_MS of expiry, otherwise refreshes (rotating the
 * single-use refresh token). Pass forceRefresh to bypass the cache — used when
 * Questrade rejects a token that our clock still considers valid.
 */
export async function getQuestradeAuth(forceRefresh = false): Promise<QuestradeAuth> {
  const row = await loadAuthRow();

  if (
    !forceRefresh &&
    row.access_token &&
    row.api_server &&
    row.expires_at &&
    new Date(row.expires_at).getTime() - Date.now() > EXPIRY_MARGIN_MS
  ) {
    return { accessToken: row.access_token, apiServer: stripTrailingSlash(row.api_server) };
  }

  return refreshAccessToken(row.refresh_token);
}

/** Authenticated GET against the account's Questrade api_server. */
export async function questradeGet<T>(path: string): Promise<T> {
  let auth = await getQuestradeAuth();
  let res = await fetch(`${auth.apiServer}${path}`, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  });

  // Questrade can invalidate an access token before our stored expiry (e.g. when
  // a newer token is issued). On 401, force a refresh once and retry.
  if (res.status === 401) {
    auth = await getQuestradeAuth(true);
    res = await fetch(`${auth.apiServer}${path}`, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    });
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Questrade GET ${path} failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<T>;
}
