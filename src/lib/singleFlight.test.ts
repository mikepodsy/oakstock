import { describe, it, expect, vi } from "vitest";
import { singleFlight } from "./singleFlight";

describe("singleFlight", () => {
  it("coalesces concurrent calls into a single underlying invocation", async () => {
    let resolveInner: (v: number) => void = () => {};
    const inner = vi.fn(
      () => new Promise<number>((resolve) => (resolveInner = resolve))
    );
    const wrapped = singleFlight(inner);

    // Fire several concurrent calls while the first is still pending.
    const calls = [wrapped(), wrapped(), wrapped(), wrapped()];
    expect(inner).toHaveBeenCalledTimes(1);

    resolveInner(42);
    const results = await Promise.all(calls);

    // All callers get the same resolved value from the one invocation.
    expect(results).toEqual([42, 42, 42, 42]);
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it("starts a fresh invocation once the in-flight call has settled", async () => {
    const inner = vi.fn(async () => Math.random());
    const wrapped = singleFlight(inner);

    await wrapped();
    await wrapped();

    // Sequential (non-overlapping) calls each trigger their own invocation.
    expect(inner).toHaveBeenCalledTimes(2);
  });

  it("clears the in-flight slot after rejection so retries can proceed", async () => {
    let attempt = 0;
    const inner = vi.fn(async () => {
      attempt++;
      if (attempt === 1) throw new Error("boom");
      return "ok";
    });
    const wrapped = singleFlight(inner);

    await expect(wrapped()).rejects.toThrow("boom");
    await expect(wrapped()).resolves.toBe("ok");
    expect(inner).toHaveBeenCalledTimes(2);
  });
});
