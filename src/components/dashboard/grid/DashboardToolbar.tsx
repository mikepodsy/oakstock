"use client";

// Layout tabs across the top of the chart workspace: switch, rename, duplicate
// and delete named layouts, plus the entry point for adding a chart.

import { useState } from "react";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { useDashboardLayoutStore } from "@/stores/dashboardLayoutStore";
import { AddChartDialog } from "./AddChartDialog";

export function DashboardToolbar() {
  const layouts = useDashboardLayoutStore((s) => s.layouts);
  const activeLayoutId = useDashboardLayoutStore((s) => s.activeLayoutId);
  const setActiveLayout = useDashboardLayoutStore((s) => s.setActiveLayout);
  const addLayout = useDashboardLayoutStore((s) => s.addLayout);
  const renameLayout = useDashboardLayoutStore((s) => s.renameLayout);
  const duplicateLayout = useDashboardLayoutStore((s) => s.duplicateLayout);
  const deleteLayout = useDashboardLayoutStore((s) => s.deleteLayout);

  // Non-null while renaming; holds the in-progress text.
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  function commitRename(id: string) {
    renameLayout(id, draft);
    setEditing(null);
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {layouts.map((l) => {
          const isActive = l.id === activeLayoutId;

          if (editing === l.id) {
            return (
              <input
                key={l.id}
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => commitRename(l.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename(l.id);
                  if (e.key === "Escape") setEditing(null);
                }}
                className="w-28 rounded-full border border-green-primary bg-bg-secondary px-3 py-1 text-xs text-text-primary outline-none"
              />
            );
          }

          return (
            <div
              key={l.id}
              className={`group flex items-center gap-1 rounded-full border px-3 py-1 transition-colors ${
                isActive
                  ? "border-green-primary bg-bg-elevated"
                  : "border-border-primary hover:bg-bg-elevated"
              }`}
            >
              <button
                type="button"
                onClick={() => setActiveLayout(l.id)}
                onDoubleClick={() => {
                  setDraft(l.name);
                  setEditing(l.id);
                }}
                title="Click to switch, double-click to rename"
                className={`cursor-pointer text-xs font-medium ${
                  isActive ? "text-text-primary" : "text-text-secondary"
                }`}
              >
                {l.name}
                <span className="ml-1.5 text-[10px] text-text-tertiary">
                  {l.tiles.length}
                </span>
              </button>

              {/* Per-layout actions only on the active tab, to keep the bar calm. */}
              {isActive && (
                <span className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(l.name);
                      setEditing(l.id);
                    }}
                    aria-label={`Rename ${l.name}`}
                    title="Rename"
                    className="cursor-pointer rounded p-0.5 text-text-tertiary hover:text-text-primary"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicateLayout(l.id)}
                    aria-label={`Duplicate ${l.name}`}
                    title="Duplicate"
                    className="cursor-pointer rounded p-0.5 text-text-tertiary hover:text-text-primary"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteLayout(l.id)}
                    aria-label={`Delete ${l.name}`}
                    title={
                      layouts.length <= 1
                        ? "Clears this layout (the last one is kept)"
                        : "Delete layout"
                    }
                    className="cursor-pointer rounded p-0.5 text-text-tertiary hover:text-red-primary"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => addLayout("New layout")}
          aria-label="New layout"
          title="New layout"
          className="cursor-pointer rounded-full border border-border-primary p-1.5 text-text-tertiary transition-colors hover:bg-bg-elevated hover:text-text-primary"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      <div className="ml-auto">
        <AddChartDialog />
      </div>
    </div>
  );
}
