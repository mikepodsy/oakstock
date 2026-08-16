"""FastAPI wrapper — built, not deployed.

The /backtesting page reads results straight from Supabase, so nothing needs
this today. It exists so that adding browser-triggered runs later is a deploy
decision rather than a rewrite.

fastapi is an optional dependency (`pip install -e ".[api]"`); the CLI works
without it.

    uvicorn oakbt.api:app --reload
"""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel

from oakbt.config import ExecutionConfig, RunConfig
from oakbt.data import store
from oakbt.engine.runner import run_backtest
from oakbt.persist.writer import persist

try:
    from fastapi import FastAPI, HTTPException
except ImportError as exc:  # pragma: no cover
    raise ImportError(
        'FastAPI is optional. Install it with: pip install -e ".[api]"'
    ) from exc

app = FastAPI(title="Oakstock Backtesting", version="0.1.0")


class RunRequest(BaseModel):
    strategy: str
    market: str | None = None
    ticker: str | None = None
    params: dict = {}
    start: date | None = None
    end: date | None = None
    signal_lag: int = 1
    target_vol: float | None = 0.15
    stop_pct: float | None = None


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/runs")
def list_runs(limit: int = 20) -> list[dict]:
    res = (
        store.client()
        .table("backtest_runs")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return res.data or []


@app.post("/runs")
def create_run(req: RunRequest) -> dict:
    from oakbt.cli import default_category, resolve_target
    from oakbt.strategies import get_strategy

    try:
        target = resolve_target(req.market, req.ticker)
    except SystemExit as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None

    cfg = RunConfig(
        strategy=req.strategy,
        ticker=target.ticker,
        market_code=target.market_code,
        dataset=target.dataset,
        proxy_quality=target.proxy_quality,
        params=default_category(req.params, target.dataset,
                                get_strategy(req.strategy)),
        start=req.start,
        end=req.end,
        execution=ExecutionConfig(
            signal_lag=req.signal_lag,
            target_vol=req.target_vol,
            stop_pct=req.stop_pct,
        ),
    )

    try:
        result = run_backtest(cfg)
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None

    return {"run_id": persist(result), "metrics": result.metrics}
