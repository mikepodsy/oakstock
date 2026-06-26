// A lightweight-charts series primitive that shades intraday US-equity trading
// sessions (pre-market / regular / after-hours) as background bands behind the
// candles. It maps each session segment's start/end time to x-coordinates via
// the chart's time scale on every frame, so it tracks panning and zooming.

import type {
  ISeriesPrimitive,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  PrimitivePaneViewZOrder,
  SeriesAttachedParameter,
  Time,
  IChartApi,
} from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type { SessionSegment } from "@/utils/indicators";
import { SESSION_TINTS } from "@/utils/indicatorConfig";

interface Band {
  left: number;
  right: number;
  color: string;
}

class SessionPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly bands: Band[]) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace((scope) => {
      const ctx = scope.context;
      const height = scope.mediaSize.height;
      for (const band of this.bands) {
        const width = band.right - band.left;
        if (width <= 0) continue;
        ctx.fillStyle = band.color;
        ctx.fillRect(band.left, 0, width, height);
      }
    });
  }
}

class SessionPaneView implements IPrimitivePaneView {
  constructor(private readonly source: SessionBackgroundPrimitive) {}

  zOrder(): PrimitivePaneViewZOrder {
    return "bottom"; // behind the candles/grid
  }

  renderer(): IPrimitivePaneRenderer | null {
    const chart = this.source.chart;
    if (!chart) return null;
    const timeScale = chart.timeScale();
    const width = timeScale.width();
    // Half a bar of padding so adjacent same-session bars read as one band.
    const halfBar = timeScale.options().barSpacing / 2;

    const bands: Band[] = [];
    for (const seg of this.source.segments) {
      const start = timeScale.timeToCoordinate(seg.start as Time);
      const end = timeScale.timeToCoordinate(seg.end as Time);
      if (start === null || end === null) continue;
      const left = Math.max(0, start - halfBar);
      const right = Math.min(width, end + halfBar);
      bands.push({ left, right, color: SESSION_TINTS[seg.session] });
    }
    return new SessionPaneRenderer(bands);
  }
}

export class SessionBackgroundPrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null;
  segments: SessionSegment[] = [];
  private readonly view = new SessionPaneView(this);
  private requestUpdate?: () => void;

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.chart = null;
    this.requestUpdate = undefined;
  }

  setSegments(segments: SessionSegment[]): void {
    this.segments = segments;
    this.requestUpdate?.();
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.view];
  }
}
