// A lightweight-charts series primitive that draws user-placed diagonal
// trendlines (segments connecting two {time, price} points) plus the in-progress
// preview while a new line is being placed. Every frame it maps each endpoint to
// pixel coordinates via the chart's time scale and the series' price scale, so
// the lines track panning, zooming, and the chart's vertical price-pan offset.

import type {
  ISeriesPrimitive,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  PrimitivePaneViewZOrder,
  SeriesAttachedParameter,
  ISeriesApi,
  SeriesType,
  Time,
  IChartApi,
} from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type { Trendline, TrendPoint } from "@/stores/drawingStore";

// A draft line being placed: the committed first point and the live cursor point.
export interface TrendlineDraft {
  p1: TrendPoint;
  cursor: TrendPoint;
}

interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  highlighted: boolean;
  // Draw endpoint handles (for the hovered/pending line so they can be grabbed).
  handles: boolean;
}

const LINE_COLOR = "#22d3ee";
const HANDLE_RADIUS = 4;

class TrendlinePaneRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly segments: Segment[],
    private readonly draft: Segment | null
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace((scope) => {
      const ctx = scope.context;
      for (const seg of this.segments) this.drawSegment(ctx, seg, false);
      if (this.draft) this.drawSegment(ctx, this.draft, true);
    });
  }

  private drawSegment(
    ctx: CanvasRenderingContext2D,
    seg: Segment,
    dashed: boolean
  ): void {
    ctx.save();
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = seg.highlighted ? 3 : 2;
    ctx.setLineDash(dashed ? [5, 4] : []);
    ctx.beginPath();
    ctx.moveTo(seg.x1, seg.y1);
    ctx.lineTo(seg.x2, seg.y2);
    ctx.stroke();

    if (seg.handles) {
      ctx.setLineDash([]);
      ctx.fillStyle = LINE_COLOR;
      for (const [hx, hy] of [
        [seg.x1, seg.y1],
        [seg.x2, seg.y2],
      ]) {
        ctx.beginPath();
        ctx.arc(hx, hy, HANDLE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

class TrendlinePaneView implements IPrimitivePaneView {
  constructor(private readonly source: TrendlinePrimitive) {}

  zOrder(): PrimitivePaneViewZOrder {
    return "top"; // above candles, like other drawings
  }

  renderer(): IPrimitivePaneRenderer | null {
    const { chart, series } = this.source;
    if (!chart || !series) return null;
    const timeScale = chart.timeScale();

    const toXY = (pt: TrendPoint): { x: number; y: number } | null => {
      const x = timeScale.timeToCoordinate(pt.time as Time);
      const y = series.priceToCoordinate(pt.price);
      if (x === null || y === null) return null;
      return { x, y };
    };

    const segments: Segment[] = [];
    for (const t of this.source.trendlines) {
      const a = toXY(t.p1);
      const b = toXY(t.p2);
      if (!a || !b) continue;
      const highlighted = t.id === this.source.hoveredId;
      segments.push({
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        highlighted,
        handles: highlighted,
      });
    }

    let draftSeg: Segment | null = null;
    if (this.source.draft) {
      const a = toXY(this.source.draft.p1);
      const b = toXY(this.source.draft.cursor);
      if (a && b) {
        draftSeg = {
          x1: a.x,
          y1: a.y,
          x2: b.x,
          y2: b.y,
          highlighted: false,
          handles: true,
        };
      }
    }

    return new TrendlinePaneRenderer(segments, draftSeg);
  }
}

export class TrendlinePrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null;
  series: ISeriesApi<SeriesType> | null = null;
  trendlines: Trendline[] = [];
  draft: TrendlineDraft | null = null;
  hoveredId: string | null = null;

  private readonly view = new TrendlinePaneView(this);
  private requestUpdate?: () => void;

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.series = param.series;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.chart = null;
    this.series = null;
    this.requestUpdate = undefined;
  }

  setTrendlines(trendlines: Trendline[]): void {
    this.trendlines = trendlines;
    this.requestUpdate?.();
  }

  setDraft(draft: TrendlineDraft | null): void {
    this.draft = draft;
    this.requestUpdate?.();
  }

  setHovered(id: string | null): void {
    if (this.hoveredId === id) return;
    this.hoveredId = id;
    this.requestUpdate?.();
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.view];
  }
}
