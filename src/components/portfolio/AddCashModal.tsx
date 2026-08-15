"use client";

import { useState } from "react";
import { usePortfolioStore } from "@/stores/portfolioStore";
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
import { formatCurrency } from "@/utils/formatters";
import { toast } from "sonner";

type Mode = "add" | "set";

export function AddCashModal({
  portfolioId,
  currentBalance,
  currency,
  children,
}: {
  portfolioId: string;
  currentBalance: number;
  currency: "CAD" | "USD";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("add");
  const [amount, setAmount] = useState("");
  const [currencyValue, setCurrencyValue] = useState<"CAD" | "USD">(currency);
  const [saving, setSaving] = useState(false);

  const updatePortfolio = usePortfolioStore((s) => s.updatePortfolio);

  const parsed = parseFloat(amount);
  // "add" takes a negative amount so a withdrawal is just a minus sign; "set"
  // is an absolute balance. Either way the result can't go below zero.
  const valid =
    Number.isFinite(parsed) && (mode === "add" ? parsed !== 0 : parsed >= 0);
  const newBalance = mode === "add" ? currentBalance + parsed : parsed;

  function resetForm() {
    setMode("add");
    setAmount("");
    setCurrencyValue(currency);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || saving) return;

    const next = Math.round(newBalance * 100) / 100;
    if (next < 0) {
      toast.error("Cash balance can't go below zero");
      return;
    }

    setSaving(true);
    try {
      await updatePortfolio(portfolioId, {
        cashBalance: next,
        cashCurrency: currencyValue,
      });
      toast.success(
        mode === "set"
          ? `Cash balance set to ${formatCurrency(next, currencyValue)}`
          : parsed < 0
            ? `Withdrew ${formatCurrency(Math.abs(parsed), currencyValue)} cash`
            : `Added ${formatCurrency(parsed, currencyValue)} cash`
      );
      resetForm();
      setOpen(false);
    } catch {
      toast.error("Failed to update cash balance");
    } finally {
      setSaving(false);
    }
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
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-text-primary font-display">
              Add Cash
            </DialogTitle>
            <DialogDescription className="text-text-secondary">
              Current balance:{" "}
              <span className="font-financial text-text-primary">
                {formatCurrency(currentBalance, currency)}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Add to the balance, or overwrite it outright */}
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-bg-tertiary p-1">
              {(
                [
                  ["add", "Add to balance"],
                  ["set", "Set balance"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                    mode === value
                      ? "bg-bg-secondary text-text-primary"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-4">
              <div className="grid gap-2">
                <label className="text-sm text-text-secondary">Amount *</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">
                    $
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="10000.00"
                    className="pl-6 bg-bg-tertiary border-border-primary text-text-primary font-financial"
                    autoFocus
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-sm text-text-secondary">Currency</label>
                <select
                  value={currencyValue}
                  onChange={(e) =>
                    setCurrencyValue(e.target.value as "CAD" | "USD")
                  }
                  className="h-9 rounded-md border border-border-primary bg-bg-tertiary px-2 text-sm text-text-primary outline-none cursor-pointer"
                >
                  <option value="USD">USD</option>
                  <option value="CAD">CAD</option>
                </select>
              </div>
            </div>

            {valid && amount !== "" && (
              <p className="text-sm text-text-tertiary">
                New balance:{" "}
                <span
                  className={`font-financial ${
                    newBalance < 0 ? "text-red-primary" : "text-text-primary"
                  }`}
                >
                  {formatCurrency(newBalance, currencyValue)}
                </span>
              </p>
            )}
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
            <Button type="submit" disabled={!valid || newBalance < 0 || saving}>
              {saving ? "Saving…" : mode === "add" ? "Add Cash" : "Set Balance"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
