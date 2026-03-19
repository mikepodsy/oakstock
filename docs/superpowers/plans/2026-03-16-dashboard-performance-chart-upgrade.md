# Dashboard Performance Chart Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the dashboard chart to a full-featured performance chart with benchmark overlay, cost basis, gain/loss tooltip, and user-selectable benchmark dropdown — by reusing the existing `PerformanceChart` component.

**Architecture:** Extend `PerformanceChart` with optional `title`, `benchmarkOptions`, and `onBenchmarkChange` props. When `benchmarkOptions` is provided, an inline dropdown renders using the existing shadcn `DropdownMenu`. The dashboard page switches from `CombinedChart` to `PerformanceChart` with these new props. `CombinedChart` is then deleted.

**Tech Stack:** Next.js 15, React 19, Recharts 3.8, Zustand, shadcn (base-ui), TypeScript, Tailwind CSS

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/charts/PerformanceChart.tsx` | Modify | Add optional `title`, `benchmarkOptions`, `onBenchmarkChange` props; render benchmark dropdown when options provided |
| `src/app/page.tsx` | Modify | Add benchmark state, replace `CombinedChart` with `PerformanceChart`, remove `combinedChartSimple` |
| `src/components/charts/CombinedChart.tsx` | Delete | No longer needed |

---

## Chunk 1: Extend PerformanceChart and Update Dashboard

### Task 1: Add benchmark dropdown to PerformanceChart

**Files:**
- Modify: `src/components/charts/PerformanceChart.tsx`

- [ ] **Step 1: Add new optional props to the interface**

Add `title`, `benchmarkOptions`, and `onBenchmarkChange` to `PerformanceChartProps`:

```typescript
interface PerformanceChartProps {
  data: PortfolioChartPoint[];
  benchmarkName: string;
  period: string;
  onPeriodChange: (period: string) => void;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  title?: string;
  benchmarkOptions?: { label: string; value: string }[];
  onBenchmarkChange?: (ticker: string) => void;
}
```

- [ ] **Step 2: Add dropdown imports**

Add to the existing imports at the top of the file:

```typescript
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
```

- [ ] **Step 3: Update component destructuring and header rendering**

Update the function signature to accept the new props, and replace the hardcoded "Performance" title with the `title` prop:

```typescript
export function PerformanceChart({
  data,
  benchmarkName,
  period,
  onPeriodChange,
  loading,
  error,
  onRetry,
  title = "Performance",
  benchmarkOptions,
  onBenchmarkChange,
}: PerformanceChartProps) {
```

Replace the header `<div>` (the `flex items-center justify-between mb-4` block) with:

```tsx
<div className="flex items-center justify-between mb-4">
  <h3 className="font-display text-base text-text-primary">
    {title}
  </h3>
  <div className="flex items-center gap-2">
    {benchmarkOptions && onBenchmarkChange && (
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-transparent border border-border-primary text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
          {benchmarkName}
          <ChevronDown className="h-3 w-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup
            value={benchmarkName}
            onValueChange={onBenchmarkChange}
          >
            {benchmarkOptions.map((opt) => (
              <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                {opt.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    )}
    <TimeRangePicker selected={period} onSelect={onPeriodChange} />
  </div>
</div>
```

- [ ] **Step 4: Verify the portfolio detail page still works**

Run: `npm run build`
Expected: Build succeeds — the portfolio detail page passes no `benchmarkOptions`, so the dropdown doesn't render. No breaking changes.

- [ ] **Step 5: Commit**

```bash
git add src/components/charts/PerformanceChart.tsx
git commit -m "feat(charts): add optional benchmark dropdown to PerformanceChart"
```

---

### Task 2: Update dashboard page to use PerformanceChart

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Update imports**

Replace the `CombinedChart` import with `PerformanceChart` and add `DEFAULT_BENCHMARKS`:

```typescript
// Remove this line:
import { CombinedChart } from "@/components/charts/CombinedChart";

// Add these lines:
import { PerformanceChart } from "@/components/charts/PerformanceChart";
import { DEFAULT_BENCHMARKS } from "@/utils/constants";
```

- [ ] **Step 2: Add benchmark state and update usePortfolioHistory**

Add benchmark state after the existing `period` state:

```typescript
const [benchmark, setBenchmark] = useState("SPY");
```

Update the `usePortfolioHistory` call — replace the hardcoded `"SPY"` with `benchmark`:

```typescript
const { data: combinedChartData, loading: chartLoading } =
  usePortfolioHistory(
    combinedHistoryInputs,
    benchmark,
    period,
    combinedCostBasis
  );
```

- [ ] **Step 3: Remove combinedChartSimple and build benchmarkOptions**

Delete the `combinedChartSimple` useMemo block entirely:

```typescript
// DELETE this entire block:
const combinedChartSimple = useMemo(
  () =>
    combinedChartData.map((p) => ({
      date: p.date,
      value: p.portfolioValue,
    })),
  [combinedChartData]
);
```

Add a `BENCHMARK_OPTIONS` constant **after the imports, before the component function**:

```typescript
const BENCHMARK_OPTIONS = DEFAULT_BENCHMARKS.map((b) => ({
  label: b,
  value: b,
}));
```

- [ ] **Step 4: Replace CombinedChart with PerformanceChart in JSX**

Replace:

```tsx
<CombinedChart
  data={combinedChartSimple}
  period={period}
  onPeriodChange={setPeriod}
  loading={chartLoading}
/>
```

With:

```tsx
<PerformanceChart
  data={combinedChartData}
  benchmarkName={benchmark}
  period={period}
  onPeriodChange={setPeriod}
  loading={chartLoading}
  title="Oakstock Performance"
  benchmarkOptions={BENCHMARK_OPTIONS}
  onBenchmarkChange={setBenchmark}
/>
```

- [ ] **Step 5: Verify build succeeds**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(dashboard): use PerformanceChart with benchmark selector"
```

---

### Task 3: Delete CombinedChart

**Files:**
- Delete: `src/components/charts/CombinedChart.tsx`

- [ ] **Step 1: Delete the file**

```bash
rm src/components/charts/CombinedChart.tsx
```

- [ ] **Step 2: Verify no remaining imports**

Search the codebase for any lingering references:

```bash
grep -r "CombinedChart" src/
```

Expected: No results.

- [ ] **Step 3: Verify build succeeds**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add -u src/components/charts/CombinedChart.tsx
git commit -m "chore: remove unused CombinedChart component"
```
