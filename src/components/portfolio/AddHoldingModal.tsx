"use client";

import { useState } from "react";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { TickerSearch } from "@/components/search/TickerSearch";
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

interface SelectedTicker {
  ticker: string;
  name: string;
  exchange: string;
}

export function AddHoldingModal({
  portfolioId,
  existingTickers,
  children,
}: {
  portfolioId: string;
  existingTickers: string[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<SelectedTicker | null>(null);
  const [shares, setShares] = useState("");
  const [costPerShare, setCostPerShare] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");

  const addHolding = usePortfolioStore((s) => s.addHolding);
  const addLot = usePortfolioStore((s) => s.addLot);
  const portfolios = usePortfolioStore((s) => s.portfolios);

  const isExistingTicker = selected
    ? existingTickers.includes(selected.ticker)
    : false;

  function resetForm() {
    setStep(1);
    setSelected(null);
    setShares("");
    setCostPerShare("");
    setPurchaseDate(new Date().toISOString().split("T")[0]);
    setNotes("");
  }

  function handleSelect(result: {
    ticker: string;
    name: string;
    exchange: string;
  }) {
    setSelected(result);
    setStep(2);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !shares || !costPerShare) return;

    const sharesNum = parseFloat(shares);
    const costNum = parseFloat(costPerShare);
    if (sharesNum <= 0 || costNum <= 0) return;

    const currency: "CAD" | "USD" = selected.ticker.endsWith(".TO")
      ? "CAD"
      : "USD";

    if (isExistingTicker) {
      const portfolio = portfolios.find((p) => p.id === portfolioId);
      const holding = portfolio?.holdings.find(
        (h) => h.ticker === selected.ticker
      );
      if (holding) {
        addLot(portfolioId, holding.id, {
          shares: sharesNum,
          costPerShare: costNum,
          purchaseDate,
          notes: notes.trim() || undefined,
        });
      }
    } else {
      addHolding(portfolioId, {
        ticker: selected.ticker,
        name: selected.name,
        currency,
        lots: [
          {
            id: "",
            shares: sharesNum,
            costPerShare: costNum,
            purchaseDate,
            notes: notes.trim() || undefined,
          },
        ],
        notes: undefined,
      });
    }

    toast.success(
      `Added ${sharesNum} shares of ${selected.ticker}${isExistingTicker ? " (new lot)" : ""}`
    );
    resetForm();
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <DialogTrigger render={children as React.JSX.Element} />
      <DialogContent className="bg-bg-secondary border border-border-primary sm:max-w-md">
        {step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-text-primary font-display">
                Add Holding
              </DialogTitle>
              <DialogDescription className="text-text-secondary">
                Search for a ticker symbol or company name.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <TickerSearch onSelect={handleSelect} />
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="text-text-primary font-display">
                <span className="font-financial text-green-primary">
                  {selected?.ticker}
                </span>{" "}
                — {selected?.name}
              </DialogTitle>
              {isExistingTicker && (
                <DialogDescription className="text-oak-300">
                  Adding a new lot to existing {selected?.ticker} holding.
                </DialogDescription>
              )}
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-sm text-text-secondary">
                    Shares *
                  </label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={shares}
                    onChange={(e) => setShares(e.target.value)}
                    placeholder="100"
                    className="bg-bg-tertiary border-border-primary text-text-primary font-financial"
                    autoFocus
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm text-text-secondary">
                    Cost Per Share *
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">
                      $
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={costPerShare}
                      onChange={(e) => setCostPerShare(e.target.value)}
                      placeholder="150.00"
                      className="pl-6 bg-bg-tertiary border-border-primary text-text-primary font-financial"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-sm text-text-secondary">
                  Purchase Date
                </label>
                <Input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="bg-bg-tertiary border-border-primary text-text-primary"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm text-text-secondary">Notes</label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes..."
                  className="bg-bg-tertiary border-border-primary text-text-primary"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep(1)}
                className="text-text-secondary"
              >
                Back
              </Button>
              <Button type="submit" disabled={!shares || !costPerShare}>
                {isExistingTicker ? "Add Lot" : "Add Holding"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
