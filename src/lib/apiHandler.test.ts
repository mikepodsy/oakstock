import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, TimeoutError, apiHandler, withTimeout } from "./apiHandler";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("apiHandler", () => {
  it("passes through the handler's response on success", async () => {
    const handler = apiHandler("test", async () =>
      Response.json({ ok: true })
    );
    const res = await handler();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("forwards handler arguments", async () => {
    const handler = apiHandler("test", async (a: number, b: string) =>
      Response.json({ a, b })
    );
    const res = await handler(7, "x");
    expect(await res.json()).toEqual({ a: 7, b: "x" });
  });

  it("converts a thrown ApiError into a JSON error response with its status", async () => {
    const handler = apiHandler("test", async () => {
      throw new ApiError(400, "ticker parameter is required");
    });
    const res = await handler();
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "ticker parameter is required" });
  });

  it("includes ApiError detail when present", async () => {
    const handler = apiHandler("test", async () => {
      throw new ApiError(502, "upstream failed", "rate limited");
    });
    const res = await handler();
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: "upstream failed",
      detail: "rate limited",
    });
  });

  it("converts a TimeoutError into a 504", async () => {
    const handler = apiHandler("test", async () => {
      throw new TimeoutError("yahoo quote", 5000);
    });
    const res = await handler();
    expect(res.status).toBe(504);
    expect((await res.json()).error).toMatch(/timed out/);
  });

  it("logs unexpected errors with the route name and returns a generic 500", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const boom = new Error("boom");
    const handler = apiHandler("quotes", async () => {
      throw boom;
    });
    const res = await handler();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal server error" });
    expect(spy).toHaveBeenCalledWith("[api/quotes]", boom);
  });
});

describe("withTimeout", () => {
  it("resolves with the promise value when it settles in time", async () => {
    await expect(withTimeout(Promise.resolve(42), 1000, "fast")).resolves.toBe(
      42
    );
  });

  it("rejects with the original error when the promise rejects in time", async () => {
    await expect(
      withTimeout(Promise.reject(new Error("nope")), 1000, "failing")
    ).rejects.toThrow("nope");
  });

  it("rejects with a TimeoutError when the promise is too slow", async () => {
    vi.useFakeTimers();
    const never = new Promise(() => {});
    const p = withTimeout(never, 50, "slow call");
    const assertion = expect(p).rejects.toThrow(
      "slow call timed out after 50ms"
    );
    await vi.advanceTimersByTimeAsync(51);
    await assertion;
  });
});
