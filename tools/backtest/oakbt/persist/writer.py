"""Write a RunResult to Supabase.

The run row is inserted with status='running' *before* the equity and trade rows
land, then flipped to 'complete'. That ordering is what makes a crashed process
visible: the row survives as 'running' or 'failed' rather than vanishing, so the
page shows something went wrong instead of silently listing nothing.
"""

from __future__ import annotations

import math
from datetime import date

import pandas as pd

from oakbt.config import RunConfig, RunResult
from oakbt.data import store
from oakbt.engine.metrics import drawdown_series

CHUNK = 500


def _clean(value):
    """JSON/Postgres-safe: NaN and inf are not valid JSON numbers."""
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, dict):
        return {k: _clean(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_clean(v) for v in value]
    return value


def _config_json(cfg: RunConfig) -> dict:
    ex = cfg.execution
    return {
        "signal_lag": ex.signal_lag,
        "commission_bps": ex.commission_bps,
        "slippage_bps": ex.slippage_bps,
        "target_vol": ex.target_vol,
        "vol_halflife": ex.vol_halflife,
        "max_leverage": ex.max_leverage,
        "stop_pct": ex.stop_pct,
        "stop_atr_mult": ex.stop_atr_mult,
        "trailing_stop": ex.trailing_stop,
        "risk_free": ex.risk_free,
        "initial_equity": ex.initial_equity,
    }


def create_run(cfg: RunConfig, start: date | None, end: date | None,
               version: str | None) -> str:
    row = {
        "strategy": cfg.strategy,
        "params": _clean(cfg.params),
        "ticker": cfg.ticker,
        "market_code": cfg.market_code,
        "proxy_quality": cfg.proxy_quality,
        "start_date": start.isoformat() if start else None,
        "end_date": end.isoformat() if end else None,
        "config": _config_json(cfg),
        "code_version": version,
        "status": "running",
    }
    res = store.client().table("backtest_runs").insert(row).execute()
    return res.data[0]["id"]


def fail_run(run_id: str, message: str) -> None:
    store.client().table("backtest_runs").update(
        {"status": "failed", "error": message[:2000]}
    ).eq("id", run_id).execute()


def _equity_rows(run_id: str, result: RunResult) -> list[dict]:
    dd = drawdown_series(result.equity)
    bench = result.benchmark.reindex(result.equity.index)
    pos = result.position.reindex(result.equity.index)

    rows = []
    for ts, equity in result.equity.items():
        rows.append(
            {
                "run_id": run_id,
                "date": ts.date().isoformat(),
                "equity": _clean(float(equity)),
                "benchmark_equity": _clean(_f(bench.get(ts))),
                "drawdown": _clean(_f(dd.get(ts))),
                "exposure": _clean(abs(_f(pos.get(ts)) or 0.0)),
                "position": _clean(_f(pos.get(ts))),
            }
        )
    return rows


def _f(value) -> float | None:
    if value is None or (isinstance(value, float) and not math.isfinite(value)):
        return None
    if pd.isna(value):
        return None
    return float(value)


def _trade_rows(run_id: str, result: RunResult) -> list[dict]:
    return [
        {
            "run_id": run_id,
            "entry_date": t.entry_date.isoformat(),
            "exit_date": t.exit_date.isoformat() if t.exit_date else None,
            "direction": t.direction,
            "entry_price": _clean(t.entry_price),
            "exit_price": _clean(t.exit_price),
            "size": _clean(t.size),
            "pnl": _clean(t.pnl),
            "return_pct": _clean(t.return_pct),
            "exit_reason": t.exit_reason,
            "bars_held": t.bars_held,
        }
        for t in result.trades
    ]


def persist(result: RunResult) -> str:
    """Save a completed run. Returns the run id."""
    start = result.equity.index[0].date() if len(result.equity) else None
    end = result.equity.index[-1].date() if len(result.equity) else None
    run_id = create_run(result.config, start, end, result.code_version)

    try:
        client = store.client()
        equity_rows = _equity_rows(run_id, result)
        for i in range(0, len(equity_rows), CHUNK):
            client.table("backtest_equity").insert(equity_rows[i : i + CHUNK]).execute()

        trade_rows = _trade_rows(run_id, result)
        for i in range(0, len(trade_rows), CHUNK):
            client.table("backtest_trades").insert(trade_rows[i : i + CHUNK]).execute()

        client.table("backtest_runs").update(
            {"status": "complete", "metrics": _clean(result.metrics)}
        ).eq("id", run_id).execute()
    except Exception as exc:  # noqa: BLE001 - the row must reflect the failure
        fail_run(run_id, str(exc))
        raise

    return run_id
