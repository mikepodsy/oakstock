# Reproducible runtime for the backtesting engine.
#
# Not deployed in v1 — the page is a read-only viewer and the CLI runs locally.
# This exists so that when browser-triggered runs are wanted, the deploy target
# is a decision rather than a rewrite.
#
#   docker build -t oakbt tools/backtest
#   docker run --rm --env-file .env.local oakbt backfill --years 4

FROM python:3.13-slim

# Node is needed for fetch_prices.mjs: Yahoo's chart endpoint rejects plain HTTP
# clients, and yahoo-finance2 handles the cookie/crumb handshake.
RUN apt-get update \
    && apt-get install -y --no-install-recommends nodejs npm git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml ./
COPY oakbt ./oakbt
RUN pip install --no-cache-dir -e ".[api]"

COPY fetch_prices.mjs ./
RUN npm install --no-save yahoo-finance2

ENTRYPOINT ["python", "-m", "oakbt.cli"]
CMD ["--help"]
