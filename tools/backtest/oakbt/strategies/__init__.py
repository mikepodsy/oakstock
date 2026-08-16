"""Strategy registry.

Adding a strategy is one file plus one line here.
"""

from __future__ import annotations

from oakbt.engine.strategy import Strategy
from oakbt.strategies.buy_and_hold import BuyAndHold
from oakbt.strategies.cot_index_reversal import CotIndexReversal
from oakbt.strategies.cot_net_zscore import CotNetZScore
from oakbt.strategies.rule_strategy import RuleStrategy

STRATEGIES: dict[str, type[Strategy]] = {
    BuyAndHold.name: BuyAndHold,
    CotIndexReversal.name: CotIndexReversal,
    CotNetZScore.name: CotNetZScore,
    # Driven by a rule spec rather than fixed params — see rule_strategy.py.
    RuleStrategy.name: RuleStrategy,
}


def get_strategy(name: str) -> type[Strategy]:
    try:
        return STRATEGIES[name]
    except KeyError:
        raise KeyError(
            f"unknown strategy {name!r}. Available: {', '.join(sorted(STRATEGIES))}"
        ) from None
