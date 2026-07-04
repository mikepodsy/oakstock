// Shared plumbing for API route handlers: consistent error responses,
// logging for unexpected failures, and timeouts for upstream calls.
//
// Usage:
//   export const GET = apiHandler("quotes", async (request: NextRequest) => {
//     if (!ticker) throw new ApiError(400, "ticker parameter is required");
//     const quote = await withTimeout(yf.quote(ticker), 10_000, "yahoo quote");
//     return Response.json(quote);
//   });

// Throw from a route to produce a JSON error body with a specific status.
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

// Race a promise against a timer. yahoo-finance2 calls don't accept an
// AbortSignal, so the underlying request may still complete — this only
// bounds how long we wait for it.
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() =>
    clearTimeout(timer)
  ) as Promise<T>;
}

// Wrap a route handler: ApiError/TimeoutError become structured JSON error
// responses; anything else is logged with the route name and returned as a
// generic 500 so no failure leaves the server silently.
export function apiHandler<A extends unknown[]>(
  name: string,
  fn: (...args: A) => Promise<Response>
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ApiError) {
        return Response.json(
          { error: err.message, ...(err.detail ? { detail: err.detail } : {}) },
          { status: err.status }
        );
      }
      if (err instanceof TimeoutError) {
        return Response.json({ error: err.message }, { status: 504 });
      }
      console.error(`[api/${name}]`, err);
      return Response.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}
