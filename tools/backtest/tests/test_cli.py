import pytest

from oakbt.cli import build_parser, resolve_target


def test_market_flag_resolves_proxy_and_quality():
    t = resolve_target(market="SP500", ticker=None)
    assert t.ticker == "SPY"
    assert t.market_code == "SP500"
    assert t.dataset == "tff"
    assert t.proxy_quality == "good"


def test_ticker_flag_reverse_resolves_a_known_proxy():
    t = resolve_target(market=None, ticker="GLD")
    assert t.ticker == "GLD"
    assert t.market_code == "GOLD"
    assert t.dataset == "disaggregated"
    assert t.proxy_quality == "good"


def test_ticker_flag_is_case_insensitive():
    assert resolve_target(market=None, ticker="spy").market_code == "SP500"


def test_unknown_ticker_leaves_market_code_null():
    t = resolve_target(market=None, ticker="AAPL")
    assert t.ticker == "AAPL"
    assert t.market_code is None
    assert t.dataset is None
    assert t.proxy_quality is None


def test_degraded_proxy_quality_is_carried_through():
    assert resolve_target(market="WTI", ticker=None).proxy_quality == "degraded"


def test_supplying_both_is_an_error():
    with pytest.raises(SystemExit):
        resolve_target(market="SP500", ticker="SPY")


def test_supplying_neither_is_an_error():
    with pytest.raises(SystemExit):
        resolve_target(market=None, ticker=None)


def test_unknown_market_is_an_error():
    with pytest.raises(SystemExit):
        resolve_target(market="ATLANTIS", ticker=None)


def test_parser_exposes_the_three_subcommands():
    parser = build_parser()
    for cmd in ("backfill", "run", "list"):
        args = parser.parse_args([cmd])
        assert args.command == cmd


def test_backfill_years_defaults_to_four():
    args = build_parser().parse_args(["backfill"])
    assert args.years == 4


def test_run_accepts_repeated_param_flags():
    args = build_parser().parse_args(
        ["run", "--strategy", "cot_index_reversal", "--market", "SP500",
         "--param", "long_below=25", "--param", "short_above=75"]
    )
    assert args.param == ["long_below=25", "short_above=75"]


def test_parse_params_coerces_numbers_and_bools():
    from oakbt.cli import parse_params

    out = parse_params(["long_below=25", "ratio=0.5", "trail=true", "cat=lev_money"])
    assert out == {
        "long_below": 25,
        "ratio": 0.5,
        "trail": True,
        "cat": "lev_money",
    }


def test_parse_params_rejects_malformed_input():
    from oakbt.cli import parse_params

    with pytest.raises(SystemExit):
        parse_params(["no_equals_sign"])
