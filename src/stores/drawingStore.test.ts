import { describe, it, expect, beforeEach } from "vitest";
import { useDrawingStore } from "./drawingStore";

const T = "TEST";
const p = (time: number, price: number) => ({ time, price });

describe("drawingStore trendlines", () => {
  beforeEach(() => {
    useDrawingStore.setState({ lines: {}, trendlines: {} });
  });

  it("adds a trendline scoped to its ticker", () => {
    useDrawingStore.getState().addTrendline(T, p(1, 100), p(2, 110));
    const list = useDrawingStore.getState().trendlines[T];
    expect(list).toHaveLength(1);
    expect(list[0].p1).toEqual({ time: 1, price: 100 });
    expect(list[0].p2).toEqual({ time: 2, price: 110 });
    expect(list[0].id).toBeTruthy();
  });

  it("moves both endpoints of an existing trendline", () => {
    useDrawingStore.getState().addTrendline(T, p(1, 100), p(2, 110));
    const id = useDrawingStore.getState().trendlines[T][0].id;
    useDrawingStore.getState().moveTrendline(T, id, p(3, 200), p(4, 210));
    const moved = useDrawingStore.getState().trendlines[T][0];
    expect(moved.p1).toEqual({ time: 3, price: 200 });
    expect(moved.p2).toEqual({ time: 4, price: 210 });
  });

  it("removes a single trendline by id", () => {
    useDrawingStore.getState().addTrendline(T, p(1, 1), p(2, 2));
    useDrawingStore.getState().addTrendline(T, p(3, 3), p(4, 4));
    const [first] = useDrawingStore.getState().trendlines[T];
    useDrawingStore.getState().removeTrendline(T, first.id);
    const list = useDrawingStore.getState().trendlines[T];
    expect(list).toHaveLength(1);
    expect(list[0].id).not.toBe(first.id);
  });

  it("clearAll wipes both lines and trendlines for the ticker", () => {
    useDrawingStore.getState().addLine(T, 50);
    useDrawingStore.getState().addTrendline(T, p(1, 1), p(2, 2));
    useDrawingStore.getState().clearAll(T);
    expect(useDrawingStore.getState().lines[T]).toEqual([]);
    expect(useDrawingStore.getState().trendlines[T]).toEqual([]);
  });
});
