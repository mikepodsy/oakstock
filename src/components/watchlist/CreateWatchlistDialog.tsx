"use client";

import { useState } from "react";
import { useWatchlistStore } from "@/stores/watchlistStore";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface CreateWatchlistDialogProps {
  children: React.ReactNode;
  onCreated?: (id: string) => void;
}

export function CreateWatchlistDialog({
  children,
  onCreated,
}: CreateWatchlistDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const createWatchlist = useWatchlistStore((s) => s.createWatchlist);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const id = await createWatchlist(name.trim());
    toast.success(`Watchlist "${name.trim()}" created`);
    setName("");
    setOpen(false);
    onCreated?.(id);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children as React.JSX.Element} />
      <DialogContent className="bg-bg-secondary border border-border-primary sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-text-primary font-display">
              Create Watchlist
            </DialogTitle>
            <DialogDescription className="text-text-secondary">
              Give your watchlist a name to organize the stocks you want to
              track.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label
                htmlFor="watchlist-name"
                className="text-sm text-text-secondary"
              >
                Name *
              </label>
              <Input
                id="watchlist-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Tech Stocks, Dividend Picks"
                className="bg-bg-tertiary border-border-primary text-text-primary"
                autoFocus
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              className="text-text-secondary"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Create Watchlist
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
