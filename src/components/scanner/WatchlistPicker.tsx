"use client";

import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Watchlist } from "@/types";

interface WatchlistPickerProps {
  watchlists: Watchlist[];
  activeWatchlist: Watchlist | undefined;
  onSelect: (id: string) => void;
}

// Same trigger styling as the chart's interval dropdown, so the two read as one
// toolbar family. Creating a list lives outside the menu — a Dialog nested in a
// menu item unmounts with the menu on click.
export function WatchlistPicker({
  watchlists,
  activeWatchlist,
  onSelect,
}: WatchlistPickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={watchlists.length === 0}
        className="flex min-w-0 cursor-pointer items-center gap-1 rounded-full border border-border-primary bg-transparent px-3 py-1 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary disabled:cursor-default disabled:opacity-60"
      >
        <span className="truncate">{activeWatchlist?.name ?? "No list"}</span>
        <ChevronDown className="h-3 w-3 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          value={activeWatchlist?.id ?? ""}
          onValueChange={onSelect}
        >
          {watchlists.map((w) => (
            <DropdownMenuRadioItem key={w.id} value={w.id}>
              {w.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
