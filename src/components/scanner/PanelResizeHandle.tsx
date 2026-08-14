"use client";

interface PanelResizeHandleProps {
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onNudge: (deltaPx: number) => void;
}

// A 1px divider with a 16px invisible hit area (the `after:` pseudo), so it is
// easy to grab without drawing a thick bar. Hidden below md, where the panel
// stacks under the chart instead of sitting beside it.
export function PanelResizeHandle({
  onPointerDown,
  onNudge,
}: PanelResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize symbol list"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        // Don't let the workspace's list navigation see this too.
        e.stopPropagation();
        e.preventDefault();
        onNudge(e.key === "ArrowLeft" ? 16 : -16);
      }}
      className="relative z-10 hidden w-px shrink-0 cursor-col-resize bg-border-primary transition-colors after:absolute after:inset-y-0 after:-left-2 after:-right-2 after:content-[''] hover:bg-green-primary focus-visible:bg-green-primary focus-visible:outline-none md:block"
    />
  );
}
