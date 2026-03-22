export const DEFAULT_BENCHMARKS = [
  "SPY",
  "XIU.TO",
  "QQQ",
  "^GSPC",
  "^GSPTSE",
] as const;

export const BENCHMARK_GROUPS = [
  {
    label: "US",
    items: [
      { ticker: "SPY", name: "S&P 500" },
      { ticker: "QQQ", name: "NASDAQ 100" },
      { ticker: "IWM", name: "Russell 2000" },
    ],
  },
  {
    label: "World",
    items: [
      { ticker: "ISF.L", name: "FTSE 100" },
      { ticker: "^GSPTSE", name: "TSX Composite Total Return" },
      { ticker: "CDZ.TO", name: "TSX Dividend Aristocrats" },
      { ticker: "EXS1.DE", name: "DAX 40" },
      { ticker: "EWQ", name: "CAC 40" },
      { ticker: "1329.T", name: "Nikkei 225" },
      { ticker: "MCHI", name: "SSE Composite" },
      { ticker: "VT", name: "FTSE Global All Cap" },
      { ticker: "URTH", name: "MSCI World" },
      { ticker: "EEM", name: "MSCI Emerging" },
      { ticker: "NSEI", name: "India Nifty 50" },
      { ticker: "ARKK", name: "ARK Innovation" },
    ],
  },
] as const;

export const MARKET_INDICES = [
  { ticker: "^GSPC", name: "S&P 500" },
  { ticker: "^GSPTSE", name: "TSX" },
  { ticker: "^IXIC", name: "NASDAQ" },
  { ticker: "^DJI", name: "DOW" },
] as const;

export const TIME_RANGES = [
  { label: "1D", value: "1d" },
  { label: "1W", value: "1w" },
  { label: "1M", value: "1m" },
  { label: "3M", value: "3m" },
  { label: "6M", value: "6m" },
  { label: "1Y", value: "1y" },
  { label: "ALL", value: "max" },
] as const;

export const RADAR_SECTORS: Record<string, { label: string; tickers: string[] }> = {
  energy: {
    label: "Energy",
    tickers: ["XOM", "CVX", "COP", "SLB", "EOG", "MPC", "PSX", "VLO", "OXY", "HAL", "DVN", "FANG", "BKR"],
  },
  information_technology: {
    label: "Information Technology",
    tickers: ["AAPL", "MSFT", "NVDA", "AVGO", "ORCL", "CRM", "AMD", "ADBE", "CSCO", "INTC", "QCOM", "TXN", "AMAT"],
  },
  financials: {
    label: "Financials",
    tickers: ["JPM", "V", "MA", "BAC", "WFC", "GS", "MS", "BLK", "SCHW", "AXP", "C", "SPGI", "CB"],
  },
  health_care: {
    label: "Health Care",
    tickers: ["UNH", "JNJ", "LLY", "PFE", "ABBV", "MRK", "TMO", "ABT", "DHR", "BMY", "AMGN", "MDT", "ISRG"],
  },
  consumer_discretionary: {
    label: "Consumer Discretionary",
    tickers: ["AMZN", "TSLA", "HD", "MCD", "NKE", "LOW", "SBUX", "TJX", "BKNG", "CMG", "ORLY", "MAR", "ROST"],
  },
  consumer_staples: {
    label: "Consumer Staples",
    tickers: ["PG", "KO", "PEP", "COST", "WMT", "PM", "MO", "CL", "MDLZ", "GIS", "KHC", "SYY", "HSY"],
  },
  industrials: {
    label: "Industrials",
    tickers: ["CAT", "UNP", "HON", "UPS", "DE", "BA", "RTX", "LMT", "GE", "MMM", "WM", "EMR", "FDX"],
  },
  materials: {
    label: "Materials",
    tickers: ["LIN", "APD", "SHW", "ECL", "FCX", "NEM", "NUE", "DOW", "DD", "VMC", "MLM", "PPG", "CE"],
  },
  utilities: {
    label: "Utilities",
    tickers: ["NEE", "SO", "DUK", "D", "AEP", "SRE", "EXC", "XEL", "ED", "WEC", "ES", "AWK", "PEG"],
  },
  real_estate: {
    label: "Real Estate",
    tickers: ["PLD", "AMT", "CCI", "EQIX", "PSA", "O", "SPG", "WELL", "DLR", "AVB", "EQR", "VTR", "ARE"],
  },
  communication_services: {
    label: "Communication Services",
    tickers: ["META", "GOOG", "NFLX", "DIS", "CMCSA", "T", "VZ", "TMUS", "CHTR", "EA", "WBD", "OMC", "TTWO"],
  },
  artificial_intelligence: {
    label: "Artificial Intelligence",
    tickers: [],
  },
  fintech: {
    label: "Fintech",
    tickers: [],
  },
  cybersecurity: {
    label: "Cybersecurity",
    tickers: [],
  },
  growth_stocks: {
    label: "Growth Stocks",
    tickers: [],
  },
  dividend_aristocrats: {
    label: "Dividend Aristocrats",
    tickers: [],
  },
  semiconductors: {
    label: "Semiconductors",
    tickers: [],
  },
  cloud_computing: {
    label: "Cloud Computing",
    tickers: [],
  },
  cannabis: {
    label: "Cannabis",
    tickers: [],
  },
} as const;

export const RADAR_SECTOR_KEYS = Object.keys(RADAR_SECTORS);
