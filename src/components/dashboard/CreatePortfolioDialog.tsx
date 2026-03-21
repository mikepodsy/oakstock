"use client";

import { useState } from "react";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { BenchmarkSelect } from "@/components/shared/BenchmarkSelect";
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

export function CreatePortfolioDialog({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [benchmark, setBenchmark] = useState("SPY");
  const createPortfolio = usePortfolioStore((s) => s.createPortfolio);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    createPortfolio(name.trim(), description.trim() || undefined, benchmark);
    toast.success(`Portfolio "${name.trim()}" created`);
    setName("");
    setDescription("");
    setBenchmark("SPY");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children as React.JSX.Element} />
      <DialogContent className="bg-bg-secondary border border-border-primary sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-text-primary font-display">
              Create Portfolio
            </DialogTitle>
            <DialogDescription className="text-text-secondary">
              Give your portfolio a name and choose a benchmark to track
              against.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label
                htmlFor="portfolio-name"
                className="text-sm text-text-secondary"
              >
                Name *
              </label>
              <Input
                id="portfolio-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Growth Portfolio"
                className="bg-bg-tertiary border-border-primary text-text-primary"
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <label
                htmlFor="portfolio-desc"
                className="text-sm text-text-secondary"
              >
                Description
              </label>
              <Input
                id="portfolio-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Long-term ETF holdings"
                className="bg-bg-tertiary border-border-primary text-text-primary"
              />
            </div>

            <div className="grid gap-2">
              <label
                htmlFor="portfolio-benchmark"
                className="text-sm text-text-secondary"
              >
                Benchmark
              </label>
              <BenchmarkSelect
                id="portfolio-benchmark"
                value={benchmark}
                onChange={setBenchmark}
                className="h-8 rounded-lg border border-border-primary bg-bg-tertiary px-2.5 text-sm text-text-primary outline-none focus:border-green-primary"
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
              Create Portfolio
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
