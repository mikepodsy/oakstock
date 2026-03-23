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
    tickers: ["XOM","CVX","COP","SLB","EOG","MPC","PSX","VLO","OXY","HAL","DVN","FANG","BKR","HES","MRO","APA","CTRA","OVV"],
  },
  information_technology: {
    label: "Information Technology",
    tickers: ["AAPL","MSFT","NVDA","AVGO","ORCL","CRM","AMD","INTC","QCOM","TXN","IBM","NOW","INTU","AMAT","MU","LRCX","KLAC","ADI","MRVL","SNPS","CDNS","ADSK","CSCO","HPQ","HPE","DELL","ACN","CTSH","INFY","IT"],
  },
  financials: {
    label: "Financials",
    tickers: ["BRK.B","JPM","V","MA","BAC","WFC","GS","MS","C","AXP","BLK","SCHW","CB","MMC","AON","MET","PRU","AIG","PGR","ALL","TRV","AFL","BX","KKR","APO","ICE","CME","CBOE","NDAQ"],
  },
  health_care: {
    label: "Health Care",
    tickers: ["UNH","JNJ","LLY","ABT","MRK","TMO","DHR","PFE","ABBV","BMY","AMGN","GILD","REGN","VRTX","MRNA","ISRG","DXCM","MDT","SYK","BSX","EW","HCA","CI","CVS","HUM"],
  },
  consumer_discretionary: {
    label: "Consumer Discretionary",
    tickers: ["AMZN","TSLA","HD","MCD","NKE","LOW","SBUX","TJX","BKNG","CMG","MAR","GM","F","ABNB","UBER","LULU","ORLY","AZO","ROST","ETSY","BBY","DECK","YUM","DRI"],
  },
  consumer_staples: {
    label: "Consumer Staples",
    tickers: ["PG","KO","PEP","COST","WMT","PM","MO","CL","MDLZ","GIS","KMB","HSY","KHC","SYY","MKC","CLX","CHD","KR","STZ","MNST","EL","ADM","TSN","CPB"],
  },
  industrials: {
    label: "Industrials",
    tickers: ["CAT","UNP","HON","UPS","DE","BA","RTX","LMT","GE","MMM","WM","EMR","FDX","ETN","PH","IR","CSX","NSC","DAL","UAL","ODFL","URI"],
  },
  materials: {
    label: "Materials",
    tickers: ["LIN","APD","SHW","ECL","FCX","NEM","NUE","DOW","DD","VMC","MLM","PPG","CE","CF","MOS","ALB","GOLD","BHP","RIO","VALE"],
  },
  utilities: {
    label: "Utilities",
    tickers: ["NEE","SO","DUK","D","AEP","SRE","EXC","XEL","ED","WEC","ES","AWK","PEG","PCG","EIX","ETR","DTE","AEE","CMS"],
  },
  real_estate: {
    label: "Real Estate",
    tickers: ["PLD","AMT","CCI","EQIX","PSA","O","SPG","WELL","DLR","AVB","EQR","VTR","ARE","INVH","VICI","IRM","EXR","MAA","SUI","NNN"],
  },
  communication_services: {
    label: "Communication Services",
    tickers: ["META","GOOGL","NFLX","DIS","CMCSA","T","VZ","TMUS","CHTR","EA","TTWO","SPOT","SNAP","PINS","MTCH","RBLX","TTD","LYV","OMC","WBD"],
  },
  artificial_intelligence: {
    label: "Artificial Intelligence",
    tickers: ["NVDA","MSFT","GOOGL","META","AMZN","IBM","PLTR","PATH","AI","SOUN","BBAI","IONQ","ARM","SMCI","VRT","SNOW","DDOG","MDB","CRM","NOW"],
  },
  software: {
    label: "Software",
    tickers: ["MSFT","ORCL","CRM","ADBE","INTU","NOW","SAP","WDAY","ADSK","TEAM","HUBS","SNPS","CDNS","VEEV","PANW","SHOP","MNDY","ZM","TWLO","DDOG"],
  },
  fintech: {
    label: "Fintech",
    tickers: ["V","MA","PYPL","SQ","FISV","FIS","GPN","COIN","SOFI","HOOD","AFRM","UPST","TOST","BILL","NU","MARA","RIOT","MSTR","RKT","LMND"],
  },
  cybersecurity: {
    label: "Cybersecurity",
    tickers: ["CRWD","PANW","FTNT","ZS","OKTA","S","CYBR","CHKP","TENB","RPD","VRNS","QLYS","GEN","NET","SAIL","BB","LDOS","SAIC","BAH","CACI"],
  },
  growth_stocks: {
    label: "Growth Stocks",
    tickers: ["NVDA","TSLA","AMZN","META","NFLX","GOOGL","CRWD","NOW","SNOW","DDOG","MDB","PLTR","APP","TTD","HIMS","CELH","ONON","DUOL","RDDT","ARM"],
  },
  dividend_aristocrats: {
    label: "Dividend Aristocrats",
    tickers: [],
  },
  semiconductors: {
    label: "Semiconductors",
    tickers: ["NVDA","AVGO","TSM","ASML","AMD","QCOM","TXN","INTC","AMAT","LRCX","KLAC","MRVL","ON","MPWR","MCHP","NXPI","ADI","MU","ARM","GFS","SMCI","SWKS","QRVO"],
  },
  cloud_computing: {
    label: "Cloud Computing",
    tickers: ["MSFT","AMZN","GOOGL","ORCL","CRM","NOW","SNOW","DDOG","NET","MDB","CFLT","WDAY","INTU","ADSK","VEEV","TEAM","HUBS","ZM","TWLO","GTLB"],
  },
  defense: {
    label: "Defense",
    tickers: ["LMT","RTX","NOC","GD","BA","HII","LHX","TDG","HEI","AXON","KTOS","LDOS","SAIC","BAH","CACI","PLTR","BWXT","AVAV","RKLB","LUNR"],
  },
  cannabis: {
    label: "Cannabis",
    tickers: [],
  },
} as const;

export const RADAR_SECTOR_KEYS = Object.keys(RADAR_SECTORS);
