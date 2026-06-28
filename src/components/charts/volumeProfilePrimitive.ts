// A lightweight-charts series primitive that draws a Volume Profile
// (volume-by-price histogram) pinned to the right edge of the candle pane. Each
// price bin becomes a horizontal bar growing leftward from the right edge, split
// two-tone into up vs down volume. The Point of Control and Value Area are drawn
// on top (when enabled). Bin prices are mapped to y-coordinates via the series'
// price scale every frame, so the profile stays aligned through pan/zoom.
//
// The heavy aggregation lives in utils/volumeProfile.ts; this only renders a
// precomputed VolumeProfile.

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
import type { VolumeProfile } from "@/utils/volumeProfile";

// Bars occupy the rightmost fraction of the pane width.
const PROFILE_WIDTH_FRAC = 0.32;
const UP_COLOR = "rgba(59, 130, 246, 0.5)"; // blue
const DOWN_COLOR = "rgba(239, 68, 68, 0.5)"; // red
const POC_COLOR = "#f59e0b"; // amber
const VALUE_AREA_FILL = "rgba(245, 158, 11, 0.1)";
const VALUE_AREA_EDGE = "rgba(245, 158, 11, 0.5)";

interface PlacedBin {
  top: number; // y of bin's high price (smaller y)
  bottom: number; // y of bin's low price
  up: number;
  down: number;
  total: number;
}

interface Placement {
  bins: PlacedBin[];
  maxBinTotal: number;
  showValueArea: boolean;
  pocY: number | null;
  vahY: number | null;
  valY: number | null;
}

class VolumeProfilePaneRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly p: Placement) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace((scope) => {
      const ctx = scope.context;
      const width = scope.mediaSize.width;
      const profileW = width * PROFILE_WIDTH_FRAC;
      const rightX = width;
      const { bins, maxBinTotal } = this.p;
      if (maxBinTotal <= 0) return;

      // Value Area band first (behind the bars).
      if (this.p.showValueArea && this.p.vahY !== null && this.p.valY !== null) {
        const bandTop = Math.min(this.p.vahY, this.p.valY);
        const bandH = Math.abs(this.p.valY - this.p.vahY);
        ctx.fillStyle = VALUE_AREA_FILL;
        ctx.fillRect(rightX - profileW, bandTop, profileW, bandH);
        ctx.strokeStyle = VALUE_AREA_EDGE;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        for (const y of [this.p.vahY, this.p.valY]) {
          ctx.beginPath();
          ctx.moveTo(rightX - profileW, Math.round(y) + 0.5);
          ctx.lineTo(rightX, Math.round(y) + 0.5);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }

      // Bars: grow leftward from the right edge; up segment inner, down outer.
      for (const b of bins) {
        const barTop = b.top;
        const barH = Math.max(1, b.bottom - b.top - 1);
        const upLen = (b.up / maxBinTotal) * profileW;
        const downLen = (b.down / maxBinTotal) * profileW;
        if (upLen > 0) {
          ctx.fillStyle = UP_COLOR;
          ctx.fillRect(rightX - upLen, barTop, upLen, barH);
        }
        if (downLen > 0) {
          ctx.fillStyle = DOWN_COLOR;
          ctx.fillRect(rightX - upLen - downLen, barTop, downLen, barH);
        }
      }

      // Point of Control line on top.
      if (this.p.pocY !== null) {
        ctx.strokeStyle = POC_COLOR;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(rightX - profileW, Math.round(this.p.pocY) + 0.5);
        ctx.lineTo(rightX, Math.round(this.p.pocY) + 0.5);
        ctx.stroke();
      }
    });
  }
}

class VolumeProfilePaneView implements IPrimitivePaneView {
  constructor(private readonly source: VolumeProfilePrimitive) {}

  zOrder(): PrimitivePaneViewZOrder {
    return "top"; // overlay the candles (bars are translucent)
  }

  renderer(): IPrimitivePaneRenderer | null {
    const { series, profile } = this.source;
    if (!series || !profile) return null;

    const bins: PlacedBin[] = [];
    for (const b of profile.bins) {
      if (b.total <= 0) continue;
      const top = series.priceToCoordinate(b.high);
      const bottom = series.priceToCoordinate(b.low);
      if (top === null || bottom === null) continue;
      bins.push({ top, bottom, up: b.up, down: b.down, total: b.total });
    }

    return new VolumeProfilePaneRenderer({
      bins,
      maxBinTotal: profile.maxBinTotal,
      showValueArea: this.source.showValueArea,
      pocY: series.priceToCoordinate(profile.poc),
      vahY: series.priceToCoordinate(profile.vah),
      valY: series.priceToCoordinate(profile.val),
    });
  }
}

export class VolumeProfilePrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null;
  series: ISeriesApi<SeriesType> | null = null;
  profile: VolumeProfile | null = null;
  showValueArea = true;

  private readonly view = new VolumeProfilePaneView(this);
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

  setProfile(profile: VolumeProfile | null, showValueArea: boolean): void {
    this.profile = profile;
    this.showValueArea = showValueArea;
    this.requestUpdate?.();
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.view];
  }
}
