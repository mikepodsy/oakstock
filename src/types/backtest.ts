// Shapes returned by /api/backtest/*. These mirror what the Python engine
// writes (tools/backtest/oakbt/persist/writer.py) — keep them in sync.

export type RunStatus = "running" | "complete" | "failed";

export type ExitReason = "signal" | "stop" | "end_of_data";

/** Metrics computed for both the strategy and its buy-and-hold benchmark. */
export interface CoreMetrics {
  total_return: number;
  cagr: number;
  volatility: number;
  sharpe: number;
  sortino: number;
  max_drawdown: number;
  calmar: number;
}

export interface BacktestMetrics extends CoreMetrics {
  trade_count: number;
  hit_rate: number;
  avg_win: number;
  avg_loss: number;
  profit_factor: number;
  avg_bars_held: number;
  exit_reasons: Partial<Record<ExitReason, number>>;
  time_in_market: number;
  turnover: number;
  benchmark?: CoreMetrics;
  excess_cagr?: number;
}

/** Execution settings the run was produced under. */
export interface BacktestRunConfig {
  signal_lag: number;
  commission_bps: number;
  slippage_bps: number;
  target_vol: number | null;
  vol_halflife: number;
  max_leverage: number;
  stop_pct: number | null;
  stop_atr_mult: number | null;
  trailing_stop: boolean;
  risk_free: number;
  initial_equity: number;
}

export interface BacktestRun {
  id: string;
  created_at: string;
  strategy: string;
  params: Record<string, unknown>;
  ticker: string;
  market_code: string | null;
  /** "degraded" flags contango-prone proxies (USO, UNG) — surfaced in the UI. */
  proxy_quality: string | null;
  start_date: string | null;
  end_date: string | null;
  status: RunStatus;
  error: string | null;
  code_version: string | null;
  metrics: BacktestMetrics | null;
  config?: BacktestRunConfig;
}

export interface EquityPoint {
  date: string;
  equity: number;
  benchmark_equity: number | null;
  drawdown: number | null;
  exposure: number | null;
  position: number | null;
}

export interface BacktestTrade {
  id: number;
  entry_date: string;
  exit_date: string | null;
  direction: "long" | "short";
  entry_price: number | null;
  exit_price: number | null;
  size: number | null;
  pnl: number | null;
  return_pct: number | null;
  exit_reason: ExitReason | null;
  bars_held: number | null;
}

export interface BacktestDetail {
  run: BacktestRun;
  equity: EquityPoint[];
  trades: BacktestTrade[];
}
