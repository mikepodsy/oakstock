# Dashboard Performance Chart Upgrade — Design Spec

## Goal

Upgrade the dashboard chart from a simple area chart (CombinedChart) to a full-featured performance chart with benchmark overlay, cost basis line, gain/loss tooltip, and a user-selectable benchmark dropdown. Achieve this by reusing the existing `PerformanceChart` component with new optional props, then deleting `CombinedChart`.

## Approach

Extend `PerformanceChart` with optional props rather than maintaining two similar chart components. The dashboard passes the new props to get benchmark comparison and a dropdown picker; the portfolio detail page continues using `PerformanceChart` as before with no changes.

---

## 1. PerformanceChart Prop Changes

**File**: `src/components/charts/PerformanceChart.tsx`

Add three optional props to the existing interface:

```typescript
interface PerformanceChartProps {
  data: PortfolioChartPoint[];
  benchmarkName: string;
  period: string;
  onPeriodChange: (period: string) => void;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  // New:
  title?: string;                                        // defaults to "Performance"
  benchmarkOptions?: { label: string; value: string }[]; // when provided, renders dropdown
  onBenchmarkChange?: (ticker: string) => void;          // called when user picks a benchmark
}
```

**Behavior**:
- `title` replaces the hardcoded "Performance" heading. Defaults to `"Performance"` when omitted.
- When `benchmarkOptions` is provided, render a benchmark dropdown to the left of the `TimeRangePicker`. When absent, no dropdown renders (existing portfolio detail behavior unchanged).
- `onBenchmarkChange` is called when the user selects a benchmark from the dropdown.

---

## 2. Benchmark Picker UI

**Built inline** inside `PerformanceChart` — not a separate component.

**Layout**:
```
[title]                          [SPY ▾]  [1W] [1M] [3M] [6M] [1Y] [ALL]
```

**Implementation**: Uses the existing shadcn `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuRadioGroup`, and `DropdownMenuRadioItem` components from `src/components/ui/dropdown-menu.tsx`.

**Trigger styling**: Small pill matching the `TimeRangePicker` inactive style — `bg-transparent border border-border-primary text-text-secondary text-xs font-mono rounded-md px-2 py-1` with a `ChevronDown` icon from lucide-react.

**Radio items**: Each benchmark option rendered as a `DropdownMenuRadioItem`. Selected item gets a checkmark via `RadioItemIndicator`.

**Conditional rendering**: The entire dropdown only renders when `benchmarkOptions` is provided.

---

## 3. Dashboard Page Changes

**File**: `src/app/page.tsx`

### Add benchmark state
```typescript
const [benchmark, setBenchmark] = useState("SPY");
```

### Update usePortfolioHistory call
Replace the hardcoded `"SPY"` with the `benchmark` state variable:
```typescript
const { data: combinedChartData, loading: chartLoading } =
  usePortfolioHistory(combinedHistoryInputs, benchmark, period, combinedCostBasis);
```

### Replace CombinedChart with PerformanceChart
Remove the `CombinedChart` import and the `combinedChartSimple` useMemo. Render `PerformanceChart` with full data:

```tsx
<PerformanceChart
  data={combinedChartData}
  benchmarkName={benchmark}
  period={period}
  onPeriodChange={setPeriod}
  loading={chartLoading}
  title="Oakstock Performance"
  benchmarkOptions={DEFAULT_BENCHMARKS.map((b) => ({ label: b, value: b }))}
  onBenchmarkChange={setBenchmark}
/>
```

The `benchmarkOptions` are derived from the existing `DEFAULT_BENCHMARKS` constant: `["SPY", "XIU.TO", "QQQ", "^GSPC", "^GSPTSE"]`.

---

## 4. Cleanup

- **Delete** `src/components/charts/CombinedChart.tsx`
- **Remove** the `CombinedChart` import from `src/app/page.tsx`
- **Remove** the `combinedChartSimple` useMemo from `src/app/page.tsx`

---

## 5. No Changes Required

- Portfolio detail page (`src/app/portfolio/[id]/page.tsx`) — continues using `PerformanceChart` without `benchmarkOptions`, so no dropdown appears
- `usePortfolioHistory` hook — already supports dynamic benchmark; no changes needed
- `ChartTooltip`, `TimeRangePicker`, `Sparkline` — untouched
- API routes — untouched

---

## 6. File Summary

### Modified Files (2)
| File | Change |
|------|--------|
| `src/components/charts/PerformanceChart.tsx` | Add `title`, `benchmarkOptions`, `onBenchmarkChange` props; render dropdown when options provided |
| `src/app/page.tsx` | Add benchmark state, replace CombinedChart with PerformanceChart, remove combinedChartSimple |

### Deleted Files (1)
| File | Reason |
|------|--------|
| `src/components/charts/CombinedChart.tsx` | Replaced by PerformanceChart with new props |
