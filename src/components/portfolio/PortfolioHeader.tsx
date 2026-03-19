"use client";

import { useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import type { Portfolio } from "@/types";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { DEFAULT_BENCHMARKS } from "@/utils/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeletePortfolioDialog } from "@/components/dashboard/DeletePortfolioDialog";
import { AddHoldingModal } from "./AddHoldingModal";

export function PortfolioHeader({ portfolio }: { portfolio: Portfolio }) {
  const updatePortfolio = usePortfolioStore((s) => s.updatePortfolio);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(portfolio.name);

  function saveName() {
    if (nameValue.trim() && nameValue.trim() !== portfolio.name) {
      updatePortfolio(portfolio.id, { name: nameValue.trim() });
    }
    setEditingName(false);
  }

  const existingTickers = portfolio.holdings.map((h) => h.ticker);

  return (
    <div className="mb-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Dashboard
      </Link>

      <div className="flex items-start justify-between">
        <div>
          {editingName ? (
            <Input
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") {
                  setNameValue(portfolio.name);
                  setEditingName(false);
                }
              }}
              className="font-display text-2xl bg-transparent border-border-primary text-text-primary h-auto py-1 px-2 -ml-2"
              autoFocus
            />
          ) : (
            <h1
              className="font-display text-2xl text-text-primary cursor-pointer hover:text-green-primary transition-colors"
              onClick={() => setEditingName(true)}
              title="Click to edit"
            >
              {portfolio.name}
            </h1>
          )}
          {portfolio.description && (
            <p className="text-sm text-text-secondary mt-1">
              {portfolio.description}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-text-tertiary">Benchmark:</span>
            <select
              value={portfolio.benchmark}
              onChange={(e) =>
                updatePortfolio(portfolio.id, { benchmark: e.target.value })
              }
              className="text-xs rounded border border-border-primary bg-bg-tertiary px-2 py-1 text-text-primary outline-none"
            >
              {DEFAULT_BENCHMARKS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <AddHoldingModal
            portfolioId={portfolio.id}
            existingTickers={existingTickers}
          >
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Holding
            </Button>
          </AddHoldingModal>
          <DeletePortfolioDialog
            portfolioId={portfolio.id}
            portfolioName={portfolio.name}
          >
            <Button variant="destructive" size="sm">
              Delete
            </Button>
          </DeletePortfolioDialog>
        </div>
      </div>
    </div>
  );
}
