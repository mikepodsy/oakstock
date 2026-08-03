"use client";

// Symbol picker for new tiles.
//
// Two tabs because the two tile kinds have genuinely different symbol spaces:
// TradingView uses exchange-qualified tickers from a curated catalog (Yahoo's
// /api/search filters to EQUITY|ETF, so it can't find futures or rates at all),
// while native tiles take a plain ticker that Questrade can resolve.

import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchTickers } from "@/services/yahooFinance";
import { useDashboardLayoutStore } from "@/stores/dashboardLayoutStore";
import { TV_SYMBOL_GROUPS } from "@/utils/tvSymbols";

type Tab = "tradingview" | "native";

export function AddChartDialog() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("tradingview");
  const addTile = useDashboardLayoutStore((s) => s.addTile);

  const [tvQuery, setTvQuery] = useState("");
  const [tickerQuery, setTickerQuery] = useState("");
  const [results, setResults] = useState<{ ticker: string; name: string }[]>([]);
  const [searching, setSearching] = useState(false);

  // Debounced equity search; the cleanup flag prevents a slow response from
  // overwriting the results of a newer query.
  useEffect(() => {
    if (tab !== "native" || tickerQuery.trim().length < 1) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const r = await searchTickers(tickerQuery.trim());
        if (!cancelled) setResults(r);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tickerQuery, tab]);

  function close() {
    setOpen(false);
    setTvQuery("");
    setTickerQuery("");
    setResults([]);
  }

  const q = tvQuery.trim().toLowerCase();
  const filteredGroups = TV_SYMBOL_GROUPS.map((g) => ({
    ...g,
    symbols: g.symbols.filter(
      (s) =>
        !q ||
        s.label.toLowerCase().includes(q) ||
        s.symbol.toLowerCase().includes(q)
    ),
  })).filter((g) => g.symbols.length > 0);

  // Anything not in the catalog can still be entered by hand, as long as it
  // looks exchange-qualified.
  const customTv = q.includes(":") ? tvQuery.trim().toUpperCase() : null;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" />
            Add chart
          </Button>
        }
      />
      <DialogContent className="border border-border-primary bg-bg-secondary sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a chart</DialogTitle>
        </DialogHeader>

        <div className="mb-3 flex gap-1">
          <button
            type="button"
            onClick={() => setTab("tradingview")}
            className={`flex-1 cursor-pointer rounded border px-3 py-1.5 text-sm transition-colors ${
              tab === "tradingview"
                ? "border-green-primary text-text-primary"
                : "border-border-primary text-text-secondary hover:text-text-primary"
            }`}
          >
            TradingView
            <span className="ml-1 text-[10px] text-text-tertiary">
              futures · bonds · FX
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab("native")}
            className={`flex-1 cursor-pointer rounded border px-3 py-1.5 text-sm transition-colors ${
              tab === "native"
                ? "border-green-primary text-text-primary"
                : "border-border-primary text-text-secondary hover:text-text-primary"
            }`}
          >
            Questrade
            <span className="ml-1 text-[10px] text-text-tertiary">
              stocks · ETFs
            </span>
          </button>
        </div>

        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <Input
            autoFocus
            value={tab === "tradingview" ? tvQuery : tickerQuery}
            onChange={(e) =>
              tab === "tradingview"
                ? setTvQuery(e.target.value)
                : setTickerQuery(e.target.value)
            }
            placeholder={
              tab === "tradingview"
                ? "Search gold, ZB, ES… or type EXCHANGE:SYMBOL"
                : "Search a stock or ETF…"
            }
            className="pl-8"
          />
        </div>

        <div className="max-h-80 overflow-y-auto">
          {tab === "tradingview" ? (
            <>
              {customTv && (
                <button
                  type="button"
                  onClick={() => {
                    addTile({ kind: "tradingview", symbol: customTv });
                    close();
                  }}
                  className="mb-1 flex w-full cursor-pointer items-center justify-between rounded px-2 py-2 text-left hover:bg-bg-tertiary"
                >
                  <span className="text-sm text-text-primary">Use “{customTv}”</span>
                  <span className="text-[10px] text-text-tertiary">custom</span>
                </button>
              )}
              {filteredGroups.map((g) => (
                <div key={g.group} className="mb-2">
                  <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-text-tertiary">
                    {g.group}
                  </div>
                  {g.symbols.map((s) => (
                    <button
                      key={s.symbol}
                      type="button"
                      onClick={() => {
                        addTile({
                          kind: "tradingview",
                          symbol: s.symbol,
                          label: s.label,
                        });
                        close();
                      }}
                      className="flex w-full cursor-pointer items-center justify-between rounded px-2 py-1.5 text-left hover:bg-bg-tertiary"
                    >
                      <span className="text-sm text-text-primary">{s.label}</span>
                      <span className="font-financial text-[11px] text-text-tertiary">
                        {s.symbol}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
              {filteredGroups.length === 0 && !customTv && (
                <p className="px-2 py-4 text-center text-sm text-text-tertiary">
                  No match. Type an exchange-qualified symbol like{" "}
                  <span className="font-financial">CBOT:ZN1!</span> to use it anyway.
                </p>
              )}
            </>
          ) : (
            <>
              {searching && (
                <p className="px-2 py-4 text-center text-sm text-text-tertiary">
                  Searching…
                </p>
              )}
              {!searching &&
                results.map((r) => (
                  <button
                    key={r.ticker}
                    type="button"
                    onClick={() => {
                      addTile({
                        kind: "native",
                        symbol: r.ticker,
                        label: r.ticker,
                        interval: "OneDay",
                      });
                      close();
                    }}
                    className="flex w-full cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 text-left hover:bg-bg-tertiary"
                  >
                    <span className="truncate text-sm text-text-primary">{r.name}</span>
                    <span className="font-financial shrink-0 text-[11px] text-text-tertiary">
                      {r.ticker}
                    </span>
                  </button>
                ))}
              {!searching && tickerQuery.trim() && results.length === 0 && (
                <p className="px-2 py-4 text-center text-sm text-text-tertiary">
                  No results.
                </p>
              )}
              {!tickerQuery.trim() && (
                <p className="px-2 py-4 text-center text-sm text-text-tertiary">
                  Search for a stock or ETF to chart with Questrade data — keeps
                  drawing tools, volume profile and full indicator settings.
                </p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
