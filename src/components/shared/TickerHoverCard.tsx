"use client";

import * as React from "react";
import { PreviewCard } from "@base-ui/react/preview-card";
import { useTickerMeta } from "@/hooks/useTickerMeta";

/**
 * Wraps a ticker trigger (typically the existing `<Link>`) in a Base UI preview
 * card that pops up below on hover, showing the full name and sector. Sector and
 * any missing name are resolved lazily via {@link useTickerMeta} only while the
 * card is open, so idle rows cost nothing.
 */
export function TickerHoverCard({
  ticker,
  name,
  children,
}: {
  ticker: string;
  name?: string | null;
  children: React.ReactElement;
}) {
  const [open, setOpen] = React.useState(false);
  const meta = useTickerMeta(ticker, name, open);

  return (
    <PreviewCard.Root open={open} onOpenChange={setOpen}>
      <PreviewCard.Trigger delay={200} closeDelay={100} render={children} />
      <PreviewCard.Portal>
        <PreviewCard.Positioner side="bottom" align="start" sideOffset={6} className="z-50">
          <PreviewCard.Popup className="max-w-[240px] rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 shadow-lg outline-none">
            <div className="font-display text-sm text-text-primary">
              {meta.name ?? (meta.loading ? "…" : ticker)}
            </div>
            {meta.sector ? (
              <div className="mt-0.5 text-xs text-text-tertiary">{meta.sector}</div>
            ) : meta.loading ? (
              <div className="mt-0.5 text-xs text-text-tertiary">Loading…</div>
            ) : null}
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  );
}
