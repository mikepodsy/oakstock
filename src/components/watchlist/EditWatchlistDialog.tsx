"use client";

import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWatchlistStore } from "@/stores/watchlistStore";
import { formatCurrency, formatPercent } from "@/utils/formatters";
import { toast } from "sonner";
import type { WatchlistItem, QuoteData } from "@/types";

interface EditWatchlistDialogProps {
  watchlistId: string;
  item: WatchlistItem;
  quote?: QuoteData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditWatchlistDialog({
  watchlistId,
  item,
  quote,
  open,
  onOpenChange,
}: EditWatchlistDialogProps) {
  const updateItem = useWatchlistStore((s) => s.updateItem);
  const removeItem = useWatchlistStore((s) => s.removeItem);

  const [targetPrice, setTargetPrice] = useState(
    item.targetPrice?.toString() ?? ""
  );
  const [notes, setNotes] = useState(item.notes ?? "");

  useEffect(() => {
    if (open) {
      setTargetPrice(item.targetPrice?.toString() ?? "");
      setNotes(item.notes ?? "");
    }
  }, [open, item.targetPrice, item.notes]);

  function handleSave() {
    const target = targetPrice ? parseFloat(targetPrice) : undefined;
    if (targetPrice && (isNaN(target!) || target! <= 0)) {
      toast.error("Target price must be greater than 0");
      return;
    }

    updateItem(watchlistId, item.id, {
      targetPrice: target,
      notes: notes.trim() || undefined,
    });

    toast.success("Watchlist item updated");
    onOpenChange(false);
  }

  function handleDelete() {
    removeItem(watchlistId, item.id);
    toast.success(`Removed ${item.ticker} from watchlist`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-bg-secondary border border-border-primary sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-text-primary font-display">
            <span className="font-financial text-green-primary">
              {item.ticker}
            </span>
            {" — "}
            {item.name}
          </DialogTitle>
          {quote && (
            <DialogDescription className="text-text-secondary">
              Current: {formatCurrency(quote.currentPrice)}{" "}
              <span
                className={
                  quote.dayChangePercent >= 0
                    ? "text-green-primary"
                    : "text-red-primary"
                }
              >
                ({formatPercent(quote.dayChangePercent)})
              </span>
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label className="text-sm text-text-secondary">Target Price</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">
                $
              </span>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="Optional"
                className="pl-6 bg-bg-tertiary border-border-primary text-text-primary font-financial"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm text-text-secondary">Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why are you watching this stock?"
              rows={4}
              className="bg-bg-tertiary border-border-primary text-text-primary"
            />
          </div>
        </div>

        <DialogFooter className="flex justify-between items-center">
          <Button
            variant="destructive"
            onClick={handleDelete}
            size="sm"
            className="mr-auto"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Remove
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
