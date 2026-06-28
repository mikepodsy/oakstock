"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { TickerSearch } from "@/components/search/TickerSearch";
import { CompanyLogo } from "@/components/shared/CompanyLogo";
import { OptionsTabs } from "@/components/options/OptionsTabs";
import { useOptionsTickerStore } from "@/stores/optionsTickerStore";
import { StrategySelector } from "@/components/options/StrategySelector";
import { LegBuilder } from "@/components/options/LegBuilder";
import { PayoffChart } from "@/components/options/PayoffChart";
import { TimeDecaySlider } from "@/components/options/TimeDecaySlider";
import { ZoomSlider } from "@/components/options/ZoomSlider";
import { PositionSummary } from "@/components/options/PositionSummary";
import { useOptionChain } from "@/hooks/useOptionChain";
import { computePayoff } from "@/lib/options/payoff";
import {
  toPayoffLegs,
  scaffoldStrategy,
  hydrateLeg,
  dteDays,
  positionAtmIv,
  dteYears,
} from "@/lib/options/position";
import { encodeLegs, decodeLegs } from "@/lib/options/shareUrl";
import type { OptionLeg, StrategyType } from "@/types/options";

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function OptionsBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticker = (params.ticker as string)?.toUpperCase() ?? "";

  const { chains, expiries, spot, defaultExpiry, loading, error, ensureExpiry } =
    useOptionChain(ticker);

  // Remember this ticker so the Options tab returns here next time.
  const setLastTicker = useOptionsTickerStore((s) => s.setLastTicker);
  useEffect(() => {
    if (ticker) setLastTicker(ticker);
  }, [ticker, setLastTicker]);

  const [strategy, setStrategy] = useState<StrategyType>("long_call");
  const [legs, setLegs] = useState<OptionLeg[]>([]);
  const [valuationFraction, setValuationFraction] = useState(0);
  const [rangePct, setRangePct] = useState(0.15);
  const [spotOverride, setSpotOverride] = useState<number | null>(null);
  const [overlays, setOverlays] = useState({
    today: true,
    intermediate: false,
    sigma1: true,
    sigma2: false,
  });

  // Decode any shared legs from the URL exactly once, before scaffolding.
  const fromUrl = useRef(false);
  const scaffolded = useRef(false);
  useEffect(() => {
    const decoded = decodeLegs(searchParams);
    if (decoded.length > 0) {
      fromUrl.current = true;
      scaffolded.current = true;
      setLegs(decoded);
      for (const l of decoded) if (l.expiry) ensureExpiry(l.expiry);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once the front chain is loaded, scaffold the default strategy (unless legs
  // came from the URL).
  useEffect(() => {
    if (scaffolded.current || !defaultExpiry) return;
    const chain = chains[defaultExpiry];
    if (!chain) return;
    scaffolded.current = true;
    setLegs(scaffoldStrategy(strategy, chain, spot));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultExpiry, chains, spot]);

  // Re-hydrate legs (mid/IV/greeks) whenever a chain or spot arrives.
  useEffect(() => {
    setLegs((prev) => prev.map((l) => hydrateLeg(l, chains, spot)));
  }, [chains, spot]);

  const handleStrategyChange = useCallback(
    (s: StrategyType) => {
      setStrategy(s);
      const chain = defaultExpiry ? chains[defaultExpiry] : undefined;
      if (s === "custom") {
        setLegs([]);
      } else if (chain) {
        setLegs(scaffoldStrategy(s, chain, spot));
      }
    },
    [chains, defaultExpiry, spot],
  );

  const updateLeg = useCallback((id: string, patch: Partial<OptionLeg>) => {
    setLegs((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }, []);
  const removeLeg = useCallback((id: string) => {
    setLegs((prev) => prev.filter((l) => l.id !== id));
  }, []);
  const addLeg = useCallback(() => {
    setLegs((prev) => [
      ...prev,
      {
        id: randomId(),
        action: "buy",
        type: "call",
        qty: 1,
        expiry: defaultExpiry,
        strike: null,
        mid: null,
        iv: null,
        ivOverride: null,
        greeks: null,
      },
    ]);
  }, [defaultExpiry]);

  const effectiveSpot = spotOverride ?? spot;

  // Hydrate legs against chains for the payoff (ensures latest mid/IV/greeks).
  const payoffLegs = useMemo(
    () => toPayoffLegs(legs.map((l) => hydrateLeg(l, chains, effectiveSpot)), effectiveSpot),
    [legs, chains, effectiveSpot],
  );

  const atmIv = useMemo(() => positionAtmIv(legs, effectiveSpot), [legs, effectiveSpot]);

  const maxDteDaysVal = useMemo(
    () => Math.max(0, ...legs.map((l) => dteDays(l.expiry) ?? 0)),
    [legs],
  );
  const maxDteYearsVal = useMemo(
    () => Math.max(0, ...legs.map((l) => dteYears(l.expiry))),
    [legs],
  );

  const sigmaBands = useMemo(() => {
    if (!effectiveSpot || !atmIv || maxDteYearsVal <= 0) return { sigma1: null, sigma2: null };
    const move = atmIv * Math.sqrt(maxDteYearsVal);
    return {
      sigma1: [effectiveSpot * (1 - move), effectiveSpot * (1 + move)] as [number, number],
      sigma2: [effectiveSpot * (1 - 2 * move), effectiveSpot * (1 + 2 * move)] as [number, number],
    };
  }, [effectiveSpot, atmIv, maxDteYearsVal]);

  const result = useMemo(() => {
    if (!effectiveSpot || payoffLegs.length === 0) return null;
    return computePayoff(payoffLegs, {
      spot: effectiveSpot,
      valuationFraction,
      atmIV: atmIv ?? undefined,
      rangePct,
    });
  }, [payoffLegs, effectiveSpot, valuationFraction, atmIv, rangePct]);

  const handleShare = useCallback(() => {
    const qs = encodeLegs(legs);
    const url = `${window.location.origin}/options/${ticker}?${qs}`;
    window.history.replaceState(null, "", `?${qs}`);
    navigator.clipboard?.writeText(url).catch(() => {});
  }, [legs, ticker]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <Skeleton className="w-48 h-7" />
        <Skeleton className="h-[440px] w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-xl font-display text-text-primary mb-2">{ticker} Options</h1>
        <p className="text-sm text-red-primary mb-1">Couldn’t load options.</p>
        <p className="text-xs text-text-tertiary">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CompanyLogo ticker={ticker} className="w-10 h-10 rounded-lg" textClassName="text-sm" />
          <h1 className="text-2xl font-display text-text-primary">{ticker}</h1>
          <div className="flex items-center gap-1 text-sm text-text-secondary">
            <span className="text-text-tertiary">Underlying</span>
            <span className="text-text-tertiary">$</span>
            <input
              type="number"
              step="0.01"
              className="w-24 bg-bg-tertiary border border-border-primary rounded-md px-2 py-1 font-financial text-text-primary focus:outline-none focus:border-oak-300"
              value={effectiveSpot ?? ""}
              onChange={(e) =>
                setSpotOverride(e.target.value === "" ? null : Number(e.target.value))
              }
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <OptionsTabs ticker={ticker} />
          <StrategySelector value={strategy} onChange={handleStrategyChange} />
          <div className="w-56">
            <TickerSearch onSelect={(r) => router.push(`/options/${r.ticker}`)} />
          </div>
        </div>
      </div>

      {/* Payoff chart + controls */}
      <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
        <div className="flex flex-wrap items-center gap-4 mb-3">
          <OverlayToggle
            label="Today"
            checked={overlays.today}
            onChange={(v) => setOverlays((o) => ({ ...o, today: v }))}
          />
          <OverlayToggle
            label="Intermediate"
            checked={overlays.intermediate}
            onChange={(v) => setOverlays((o) => ({ ...o, intermediate: v }))}
          />
          <OverlayToggle
            label="±1σ"
            checked={overlays.sigma1}
            onChange={(v) => setOverlays((o) => ({ ...o, sigma1: v }))}
          />
          <OverlayToggle
            label="±2σ"
            checked={overlays.sigma2}
            onChange={(v) => setOverlays((o) => ({ ...o, sigma2: v }))}
          />
        </div>

        {result && effectiveSpot ? (
          <>
            <div className="flex items-stretch gap-2">
              <div className="flex-1 min-w-0">
                <PayoffChart
                  result={result}
                  spot={effectiveSpot}
                  showToday={overlays.today}
                  showIntermediate={overlays.intermediate}
                  sigma1={overlays.sigma1 ? sigmaBands.sigma1 : null}
                  sigma2={overlays.sigma2 ? sigmaBands.sigma2 : null}
                />
              </div>
              <ZoomSlider rangePct={rangePct} onChange={setRangePct} />
            </div>
            {maxDteDaysVal > 0 && (
              <div className="mt-3">
                <TimeDecaySlider
                  fraction={valuationFraction}
                  maxDteDays={maxDteDaysVal}
                  onChange={setValuationFraction}
                />
              </div>
            )}
          </>
        ) : (
          <div className="h-[360px] flex items-center justify-center text-sm text-text-secondary">
            Add a complete leg (expiry + strike) to see the payoff.
          </div>
        )}
      </div>

      <LegBuilder
        legs={legs}
        chains={chains}
        expiries={expiries}
        spot={effectiveSpot}
        onUpdate={updateLeg}
        onRemove={removeLeg}
        onAdd={addLeg}
        onEnsureExpiry={ensureExpiry}
      />

      {result && <PositionSummary result={result} legs={legs} onShare={handleShare} />}
    </div>
  );
}

function OverlayToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
