import pytest

from oakbt.data import prices

# 2024-01-09 and 2024-01-10 UTC midnight-ish timestamps.
CHART = {
    "chart": {
        "result": [
            {
                "timestamp": [1704805200, 1704891600, 1704978000],
                "indicators": {
                    "quote": [
                        {
                            "open": [470.0, 472.5, None],
                            "high": [473.0, 474.0, None],
                            "low": [469.0, 471.0, None],
                            "close": [472.0, 473.5, None],
                            "volume": [80000000, 75000000, None],
                        }
                    ],
                    "adjclose": [{"adjclose": [471.1, 472.6, None]}],
                },
            }
        ],
        "error": None,
    }
}


def test_parses_ohlcv_rows():
    rows = prices.parse_chart(CHART, "SPY")
    assert len(rows) == 2  # the all-None bar is dropped
    first = rows[0]
    assert first["ticker"] == "SPY"
    assert first["open"] == 470.0
    assert first["high"] == 473.0
    assert first["low"] == 469.0
    assert first["close"] == 472.0
    assert first["adj_close"] == 471.1
    assert first["volume"] == 80000000


def test_dates_are_iso_strings():
    rows = prices.parse_chart(CHART, "SPY")
    assert rows[0]["date"] == "2024-01-09"
    assert rows[1]["date"] == "2024-01-10"


def test_null_bars_are_dropped_not_carried_as_nan():
    # Yahoo pads holidays with nulls. A NaN close would poison every return
    # computed from it, so these rows must not reach the store at all.
    rows = prices.parse_chart(CHART, "SPY")
    assert all(r["close"] is not None for r in rows)


def test_missing_adjclose_block_falls_back_to_close():
    payload = {
        "chart": {
            "result": [
                {
                    "timestamp": [1704805200],
                    "indicators": {
                        "quote": [
                            {
                                "open": [1.0],
                                "high": [2.0],
                                "low": [0.5],
                                "close": [1.5],
                                "volume": [10],
                            }
                        ]
                    },
                }
            ]
        }
    }
    rows = prices.parse_chart(payload, "X")
    assert rows[0]["adj_close"] == 1.5


def test_empty_result_yields_no_rows():
    assert prices.parse_chart({"chart": {"result": []}}, "SPY") == []
    assert prices.parse_chart({}, "SPY") == []


def test_yahoo_error_payload_raises():
    payload = {"chart": {"result": None, "error": {"description": "Not Found"}}}
    with pytest.raises(RuntimeError, match="Not Found"):
        prices.parse_chart(payload, "NOPE")


# ── Node helper path (primary, since Yahoo 429s plain HTTP clients) ────────────

NODE_ROWS = [
    {
        "date": "2024-01-09",
        "open": 470.0,
        "high": 473.0,
        "low": 469.0,
        "close": 472.0,
        "adjclose": 458.8,
        "volume": 80000000,
    },
    {"date": "2024-01-10", "open": None, "high": None, "low": None,
     "close": 473.5, "adjclose": 460.1, "volume": None},
]


def test_normalize_node_rows_maps_to_table_columns():
    rows = prices.normalize_node_rows(NODE_ROWS, "SPY")
    assert rows[0] == {
        "ticker": "SPY",
        "date": "2024-01-09",
        "open": 470.0,
        "high": 473.0,
        "low": 469.0,
        "close": 472.0,
        "adj_close": 458.8,  # note the rename from Yahoo's adjclose
        "volume": 80000000,
    }


def test_normalize_node_rows_drops_bars_without_a_close():
    rows = prices.normalize_node_rows(NODE_ROWS + [{"date": "x", "close": None}], "SPY")
    assert len(rows) == 2


def test_normalize_node_rows_defaults_adj_close_to_close():
    rows = prices.normalize_node_rows([{"date": "2024-01-09", "close": 10.0}], "X")
    assert rows[0]["adj_close"] == 10.0
