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

// The "Magnificent 7" mega-cap tech names tracked on the momentum Alerts page.
// Defined as a constant so adding/removing tickers is a one-line edit.
export const MAG7 = [
  "AAPL",
  "MSFT",
  "NVDA",
  "AMZN",
  "GOOGL",
  "META",
  "TSLA",
] as const;

// Large-cap US universe for the /alerts page right panel — roughly the S&P 500
// minus the Mag 7 (which get their own live-computed left panel). Momentum for
// these is precomputed in bulk and stored in the `momentum_status` table; the
// panel sorts by live market cap, so the order here doesn't matter. Yahoo dash
// format for class shares (e.g. BRK-B). Acquired/delisted tickers are simply
// skipped during refresh, so the list degrades gracefully.
export const LARGECAP_UNIVERSE = [
  "BRK-B", "LLY", "JPM", "V", "AVGO", "XOM", "UNH", "MA", "JNJ", "COST",
  "HD", "PG", "WMT", "NFLX", "BAC", "CRM", "ORCL", "MRK", "CVX", "KO",
  "AMD", "ADBE", "PEP", "ABBV", "ACN", "LIN", "MCD", "CSCO", "WFC", "TMO",
  "ABT", "DHR", "GE", "DIS", "INTC", "INTU", "VZ", "QCOM", "IBM", "CAT",
  "AMGN", "TXN", "NOW", "PM", "NKE", "SPGI", "UNP", "AXP", "GS", "MS",
  "RTX", "NEE", "HON", "LOW", "COP", "BKNG", "PFE", "T", "UPS", "ELV",
  "SCHW", "BLK", "SYK", "LMT", "MDT", "BA", "DE", "PLD", "ADP", "GILD",
  "TJX", "MMC", "VRTX", "CB", "ADI", "REGN", "C", "CI", "AMT", "BMY",
  "SBUX", "MO", "SO", "ZTS", "BSX", "DUK", "PGR", "EOG", "ISRG", "FI",
  "NOC", "SLB", "BDX", "ITW", "AON", "WM", "CME", "MU", "GD", "CSX",
  "PNC", "FCX", "CL", "EQIX", "MMM", "MCK", "EW", "HUM", "APD", "USB",
  "EMR", "MPC", "NSC", "FDX", "GM", "MAR", "PSX", "ORLY", "ROP", "AJG",
  "TGT", "MCO", "F", "PYPL", "VLO", "MET", "AEP", "AZO", "TT", "CARR",
  "OXY", "TFC", "SRE", "PH", "DXCM", "A", "TDG", "MSI", "ECL", "KMB",
  "ADM", "GIS", "STZ", "HCA", "NXPI", "CTAS", "MCHP", "CDNS", "PCAR", "ANET",
  "CHTR", "EXC", "KLAC", "SNPS", "IDXX", "WELL", "AIG", "ON", "COF", "TEL",
  "D", "ROST", "KMI", "MNST", "PSA", "AFL", "HLT", "NUE", "DOW", "CMG",
  "FTNT", "SPG", "EL", "JCI", "TRV", "BK", "KDP", "ODFL", "AMP", "O",
  "CNC", "NEM", "OKE", "GWW", "WMB", "PAYX", "MRNA", "FAST", "KHC", "AME",
  "CMI", "ALL", "DG", "VRSK", "OTIS", "CTSH", "PRU", "ED", "LHX", "DLTR",
  "GEHC", "KR", "DLR", "YUM", "BIIB", "IQV", "PPG", "CSGP", "DD", "EA",
  "ACGL", "EFX", "FIS", "RMD", "MLM", "WST", "KVUE", "VMC", "DVN", "AVB",
  "HSY", "CPRT", "XEL", "FANG", "GLW", "MTD", "EBAY", "ROK", "HPQ", "WBD",
  "TROW", "ANSS", "EIX", "WEC", "DFS", "CBRE", "ETR", "APH", "FTV", "KEYS",
  "CHD", "ZBH", "HIG", "WTW", "TSCO", "STT", "PFG", "DAL", "NDAQ", "GPN",
  "AWK", "MPWR", "EXR", "WY", "ULTA", "DTE", "VICI", "FE", "ES", "ALGN",
  "RJF", "STE", "INVH", "BR", "MKC", "CDW", "HAL", "PPL", "ROL", "COO",
  "ARE", "GRMN", "PWR", "BAX", "K", "NVR", "MAA", "OMC", "IFF", "CTRA",
  "LYB", "AEE", "DOV", "EXPD", "J", "CNP", "HBAN", "TYL", "FITB", "WAB",
  "VLTO", "TDY", "CMS", "BALL", "MOH", "ATO", "LH", "NTRS", "SWKS", "EQR",
  "DRI", "PHM", "AVY", "SYY", "JBHT", "CAH", "HPE", "VTR", "CCL", "WAT",
  "EG", "IT", "NTAP", "TXT", "BRO", "CLX", "AKAM", "RF", "PKG", "LUV",
  "JBL", "SBAC", "HOLX", "IEX", "SWK", "CFG", "DGX", "ALB", "POOL", "MAS",
  "EXPE", "KIM", "AES", "NDSN", "GEN", "L", "BG", "TER", "UAL", "INCY",
  "ZBRA", "CE", "JKHY", "AMCR", "SNA", "FDS", "DPZ", "RVTY", "CINF", "VRSN",
  "MGM", "TRMB", "PNR", "EPAM", "APA", "CPB", "UDR", "BBY", "TFX", "KEY",
  "WRB", "NI", "LDOS", "WDC", "STX", "MOS", "CF", "HST", "GL", "FOXA",
  "FOX", "TAP", "MKTX", "ESS", "DOC", "PODD", "CAG", "HRL", "LKQ", "JNPR",
  "REG", "AOS", "ALLE", "EMN", "KMX", "BWA", "NRG", "HII", "CHRW", "FFIV",
  "TPR", "GNRC", "AIZ", "BXP", "ETSY", "CPT", "NWSA", "NWS", "HAS", "BEN",
  "MTCH", "IPG", "PNW", "CRL", "BIO", "WBA", "SJM", "FMC", "IVZ", "CZR",
  "PARA", "MHK", "RL", "AAL", "DVA", "NCLH", "FRT", "QRVO", "HSIC", "WYNN",
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

// Candle granularity (Questrade HistoricalDataGranularity). The chart is one
// continuous pan/zoom chart; these switch the candle size, not a fixed window.
export const QUESTRADE_INTERVALS = [
  { label: "1m", value: "OneMinute" },
  { label: "5m", value: "FiveMinutes" },
  { label: "15m", value: "FifteenMinutes" },
  { label: "1h", value: "OneHour" },
  { label: "4h", value: "FourHours" },
  { label: "1D", value: "OneDay" },
  { label: "1W", value: "OneWeek" },
  { label: "1M", value: "OneMonth" },
] as const;

export const RADAR_SECTORS: Record<string, { label: string; tickers: string[] }> = {
  energy: {
    label: "Energy",
    tickers: ["XOM","CVX","COP","SLB","EOG","MPC","PSX","VLO","DVN","HAL","BKR","OXY","FANG","APA","OVV","SM","MTDR","PARR","CRC","REI","BATL","RRC","EQT","CNX","AR","LNG","CQP","NFG","SWX","OKE","KMI","WMB","ET","EPD","PAA","TRGP","MPLX","AM","EE","GEL","WES","HESM","PBF","DKL","DK","CLMT","INT","SD","GPOR","NOG","WTI","BORR","VAL","NCSM","OIS","RES","ACDC","PTEN","NBR","HP","KLXE","PUMP","WTTR","USAC","BTU","ARLP","AMR","METC","COKE","PLUG","BE","CLNE","RUN","SPWR","FSLR","ENPH","SEDG","ARRY","CSIQ","JKS","SHLS","CWEN","GPRE","REX","VGAS","RIG","SDRL"],
  },
  information_technology: {
    label: "Information Technology",
    tickers: ["AAPL","MSFT","NVDA","META","GOOGL","GOOG","AVGO","ORCL","CRM","AMD","INTC","QCOM","TXN","IBM","NOW","INTU","AMAT","MU","LRCX","KLAC","ADI","MRVL","SNPS","CDNS","PANW","FTNT","CRWD","PLTR","ADSK","TEAM","WDAY","SNOW","DDOG","ZS","OKTA","HUBS","BILL","TTWO","EA","RBLX","U","DKNG","NET","MDB","ESTC","FROG","GTLB","S","ANET","FFIV","CSCO","HPQ","HPE","DELL","STX","WDC","NTAP","VCNX","ACN","CTSH","WIT","INFY","IT","EPAM","GLOB","EXLS","CACI","SAIC","BAH","LDOS","GEN","TENB","RPD","VRNS","QLYS","SAIL","OSPN","CHKP","ANGI","CARS","CDW","SMCI","GFS","ON","MPWR","WOLF","DIOD","RMBS","SLAB","SWKS","QRVO","CRUS","FORM","ACMR","COHU","ICHR","MKSI","ENTG","MCHP","NXPI","STM","IFNNY","ASML","AEHR","PI","ACLS","ONTO","UCTT","RBBN","VIAV","CIEN","LITE","APH","TEL","KEYS","TDY","ITRI","VNET","NTES","BIDU","JD","PDD","BABA","TCOM","WB","VIPS","QFIN","LUMN","SIFY","PFGC","CEVA","BLKB","FIVN","NICE","SPSC","PCTY","PAYC","ADP","PAYX","GWRE","APPF","YEXT","ALRM","BAND","TWLO","ZM","RNG","EGHT","ATNI","LPSN","TTEC","XRX","PERI","DV","IAS","MGNI","PUBM","TTD","APP","APPS","CGNX","ISRG","PEGA","SMTC","AMBA","SYNA","PTC","ESI","MSCI","VRSK","TRI","SPGI","MCO","FDS"],
  },
  financials: {
    label: "Financials",
    tickers: ["BRK-B","JPM","V","MA","BAC","WFC","GS","MS","C","AXP","BLK","SCHW","CB","AON","MET","PRU","AIG","PGR","ALL","TRV","HIG","AFL","L","RNR","AJG","WTW","RYAN","USB","PNC","TFC","COF","SYF","ALLY","FITB","RF","CFG","HBAN","KEY","MTB","WAL","ZION","BOKF","EWBC","GBCI","UMBF","FFIN","IBCP","NBTB","SBCF","STEL","FHN","IBOC","STBA","FFBC","SPFI","FBIZ","SFBS","LKFN","SPWH","FSBW","BX","KKR","APO","CG","ARES","BAM","BN","TPG","HLNE","STEP","FNF","FAF","STC","ITIC","ICE","CME","CBOE","NDAQ","MKTX","VIRT","HOOD","IBKR","AMTD","LPLA","RJF","SF","PJT","EVR","LAZ","MC","HLI","PIPR","FHI","AMG","IVZ","EV","VRTS","GCMG","CSWC","ARCC","GBDC","HTGC","MAIN","TPVG","PSEC","GAIN","GLAD","OXSQ","PFLT","FSK","BXSL","OBDC","SSSS","OFS","SLRC","FDUS","SCM","WHF","HRZN","BCSF","SUNS","PNNT","FNB","ACNB","CHMG","BWFG","PEBO","COLB","CVBF","WAFD","BANR","NWBI","CASH","SMBC","LCNB","BUSE","TRMK","SBSI"],
  },
  health_care: {
    label: "Health Care",
    tickers: ["UNH","JNJ","LLY","ABT","MRK","TMO","DHR","AZN","NVO","PFE","ABBV","BMY","AMGN","GILD","BIIB","REGN","VRTX","MRNA","BNTX","ILMN","IDXX","EW","STE","MTD","WST","RMD","ALGN","COO","BAX","BDX","BSX","MDT","SYK","ZBH","HSIC","DVA","HUM","CVS","CI","ELV","CNC","MOH","HCA","THC","UHS","DOCS","HIMS","PHR","RXRX","SDGR","SEER","PACB","BEAM","NTLA","EDIT","CRSP","FATE","KYMR","ARQT","IMVT","PRAX","ARVN","ZNTL","CORT","HALO","NTRA","VEEV","HSTM","PGNY","ACGL","OMCL","QGEN","WAT","BRKR","PRA","MEDP","ICLR","CRL","NEOG","ATRC","INSP","TNDM","DXCM","PODD","GKOS","IRTC","NVCR","AVNS","HAE","MMSI","ATEC","ENSG","NHC","ACHC","BHVN","SRRK","ARWR","RARE","ACAD","AXSM","SUPN","HRMY","SIGA","PTGX","TARS","PRGO","PAHC","PCRX","LNTH","EVGO","NKTR","RGEN","MEDX","PRVA","GOCO","EHTH","HQY","OOMA","CRVS","TRVI","ADMA","AGEN","ALEC","MNKD","RSSS","EHC","CCRN","AMN","TBI","HCSG","PINC","GMED","NUVB","BCYC","ALLO","SGMO","XENE","RNA","TELA"],
  },
  consumer_discretionary: {
    label: "Consumer Discretionary",
    tickers: ["AMZN","TSLA","HD","MCD","NKE","LOW","SBUX","TJX","BKNG","MAR","GM","F","RIVN","LCID","RCL","CCL","LVS","MGM","WYNN","CZR","EXPE","ABNB","UBER","LYFT","DRI","YUM","CMG","WING","SHAK","TXRH","EAT","JACK","WEN","QSR","SONO","PTON","FTDR","SCI","PVH","RL","GOOS","TPR","CPRI","VFC","UAA","UA","LULU","ONON","BIRD","ANF","AEO","CROX","DECK","SHOO","WWW","CAL","BBW","PLCE","BURL","ROST","M","KSS","BBBY","W","ETSY","CHWY","PETS","WOOF","FND","LESL","SBH","ULTA","EL","RGS","PATK","LCII","THO","WGO","CWH","BC","MBUU","MCFT","FOXF","POWW","SWBI","RGR","STLA","TM","HMC","NSANY","VWAGY","RACE","LEA","ALV","BWA","APTV","DAN","THRM","DRVN","ABG","LAD","AN","KMX","PAG","SAH","GPI","RUSHA","ORLY","AZO","AAP","GPC","LKQ","MNRO","SNA","MLM","NFLX","DIS","PARA","WBD","LYV","AMC","CNK","IMAX","MSGM","PENN","RRR","CHDN","GAMB","MTN","PLNT","XPOF","GFAI","BBY"],
  },
  consumer_staples: {
    label: "Consumer Staples",
    tickers: ["PG","KO","PEP","COST","WMT","PM","MO","CL","MDLZ","KMB","GIS","CPB","HRL","MKC","SJM","CAG","BGS","JJSF","SMPL","NOMD","AMBS","VITL","BRBS","CENT","CENTA","CHEF","USFD","SFM","WFRD","KR","ACI","GO","CASY","MUSA","PTLO","HSY","RMCF","FRPT","HAIN","INGR","ENR","REYN","IPAR","EL","COTY","ELF","PLBY","SKIN","NPKI","CLX","CHD","HELE","PBH","POST","TAP","BUD","SAM","ABEV","FMX","MNST","CELH","REED","FIZZ","COKE","KDP","CCEP","OTLY","BRBR","NU","PLNT","BTI","TPB","XXII","STZ","MGPI","MOND","ADM","BG","CALM","LWAY","JBSS","SENEA","SEB","TSN","PPC","WH","CHH","IHG","GPRO","NAT","PRPL","SNBR","LOGI","GRMN","KNSL","EG"],
  },
  industrials: {
    label: "Industrials",
    tickers: ["RTX","HON","UPS","BA","CAT","DE","GE","MMM","ETN","EMR","FDX","LMT","NOC","GD","HII","LHX","TXT","HEI","TDG","AXON","KTOS","DRS","AER","AAL","DAL","UAL","LUV","ALK","JBLU","SKYW","CSX","NSC","UNP","CP","CNI","WAB","TRN","RAIL","GBX","RXO","XPO","CHRW","EXPD","ECHO","FWRD","SAIA","ODFL","ARCB","MRTN","HTLD","KNX","WERN","JBHT","LSTR","HUBG","CVLG","GATX","GFF","PH","IR","GNRC","AOS","WTS","FELE","REX","SPXC","FLOW","BWXT","HLIO","CECO","MWA","NWN","ITT","ROP","LDOS","CACI","DLB","VPG","OFLX","NWPX","WDFC","RBA","CPRT","CLBT","SLAB","OSK","PCAR","CMI","AGCO","LNN","TEX","MTW","ALG","HRI","URI","TREX","BLDR","MAS","MHK","AWI","VMC","EXP","USLM","RGLD","NVT","GNSS","ARAY","PKOH","STRT","SXI","ESE","TWIN","JELD","SSD","CSTE","GRBK","LGIH","TMHC","SKY","CCS","CVCO","LEGH"],
  },
  materials: {
    label: "Materials",
    tickers: ["LIN","APD","SHW","NEM","FCX","NUE","PPG","ECL","DD","DOW","LYB","EMN","CE","CF","MOS","IFF","FMC","ALB","AVTR","RPM","AXTA","HUN","OLN","ASH","TROX","CC","IOSP","MEOH","BCPC","WLK","HCC","METC","BTU","ARLP","CLF","MT","STLD","RS","WOR","KALU","CENX","AA","ACH","CSTM","KRO","TG","HL","CDE","PAAS","AG","FSM","SSRM","EGO","IAG","KGC","GOLD","AEM","FNV","WPM","RGLD","OR","MTA","AUMN","MUX","GFI","AU","HMY","SBSW","ANGPY","BHP","RIO","VALE","TECK","SCCO","FM","GLNCY","AGLXY","VMC","MLM","EXP","USLM","CRH","EBF","CX","PKG","IP","SLGN","ATR","SON","AMBP","BALL","CCK","CANSF","OI","MERC","LGND","CLW","PW","UFPI","LPX","BLDR","MAS","AWI","TREX","CSL","IBP","JELD","SSD","NX","CSTE","TILE","MHK","FLXS","WLKP","AMKR","ONTO","AZTA"],
  },
  utilities: {
    label: "Utilities",
    tickers: ["NEE","DUK","SO","D","AEP","EXC","XEL","PCG","ED","WEC","ES","ETR","PPL","DTE","AEE","CMS","CNP","NI","LNT","PNW","EVRG","OGE","IDA","AVA","NWE","OTTR","MDU","BKH","MGEE","POR","HE","EIX","SRE","AWK","WTRG","MSEX","YORW","ARTNA","CWCO","PESI","UTL","HASI","BEP","BEPC","ORA","AMRC","ARRY","GLOW","FE","NRG","VST","TLNE","CIG","SBS","PAM","TGS","EDN","VIV","SR","SWX","NWN","NFG","UGI","SPH","GLP","MIC","AWR","GWRS","CLFD","ERII","CDZI","ARIS","PURE","TNC","ATGN","ELLO","CWT","BWEN","EAF","GPRE","DNNGY","IBDRY","ESOCF","ENGIY","RWEOY","FTS","H","EMA","AQN","BIP","BIPC"],
  },
  real_estate: {
    label: "Real Estate",
    tickers: ["PLD","AMT","EQIX","CCI","SPG","WELL","DLR","PSA","EXR","O","VICI","IRM","AVB","EQR","MAA","UDR","CPT","NNN","ADC","STAG","REXR","EGP","TRNO","LXP","COLD","FR","CUBE","NSA","SELF","REG","KIM","BRX","SITC","CBL","MAC","SRG","VNO","SLG","BXP","DEI","CUZ","HIW","CLDT","RHP","HST","PK","SHO","APLE","XHR","BHR","INN","RLJ","ILPT","NXRT","IRT","ELME","NVCR","FCPT","SVC","OPI","HPP","JBGS","CXW","GEO","SBAC","UNIT","AMH","INVH","GTLS","STRS","FRPH","UE","GNL","PINE","EPRT","NTST","PSTL","GIPR","BRSP","MHO","GRBK","LGIH","CCS","TMHC","BZH","HOV","CVCO","SKY","LEGH","KBH","NVR","DHI","LEN","PHM","TOL","ELS","SUI","UMH","IIIV","WSFS","SLQT","LADR","ACR","KREF","GPMT","TRTX","BXMT","AFCG","FBRT","ARI","RC","CHMI","RWT","QNST","LMND","HIMAX"],
  },
  communication_services: {
    label: "Communication Services",
    tickers: ["META","GOOGL","NFLX","DIS","CMCSA","T","VZ","TMUS","CHTR","WBD","PARA","FOX","FOXA","LYV","OMC","NWSA","NWS","NYT","SNAP","PINS","MTCH","BMBL","MQ","ZG","Z","ANGI","CARS","CARG","TTGT","ZETA","PUBM","MGNI","TTD","CRTO","IAS","DV","GOOG","YELP","TRIP","OPEN","REAL","MELI","SE","GLOB","LPSN","BAND","TWLO","MSGS","SPXC","CCI","AMT","SBAC","UNIT","TIGO","LILA","LILAK","CABO","CCOI","LUMN","TDS","SHEN","IRDM","VSAT","GSAT","SPCE","RKLB","MNTS","ASTS","GILT","SIRI","IHRT","NXST","SBGI","GTN","SSP","SALM","EMMS","LPLA","AMC","AMCX","NCMI","RGS","MPLX","SPOT","PTON","DKNG","PENN","CHGG","LAUR","PRDO","GHC","LINC","COUR","DUOL","APEI","NICE","BRZE","FROG"],
  },
  artificial_intelligence: {
    label: "Artificial Intelligence",
    tickers: ["NVDA","MSFT","GOOGL","META","AMZN","IBM","ORCL","PLTR","PATH","AI","BBAI","SOUN","GFAI","IONQ","QBTS","RGTI","ARQQ","QUBT","RXRX","SDGR","ABSI","TWST","NICE","VRNT","PEGA","SYM","MBLY","LAZR","MVIS","AEVA","OUST","INVZ","LIDR","INDI","KSCP","AISP","CXAI","ARBB","AIXI","AIOT","RBOT","ISRG","PRCT","BFLY","DDOG","SNOW","MDB","ESTC","DT","PD","PTC","SNPS","CDNS","MSCI","VRSK","SPGI","MCO","FDS","IT","TTGT","ZETA","RAMP","TTD","APP","DV","IAS","MGNI","PUBM","CRTO","PERI","RDDT","ACVA","CARG","ZG","OPEN","DOCS","HIMS","PGNY","PHR","OMCL","TDOC","AMWL","OPRX","CLOV","NTRA","ILMN","PACB","BEAM","NTLA","CRSP","EDIT","SEER","BIDU","JD","BABA","NTES","PDD","TCOM","IQ","BILI","SE","MELI","GRAB","DUOL","COUR","CHGG","ACN","CTSH","INFY","WIT","GLOB","EPAM","EXLS","G","CNXC","TASK","TRI","COIN","MSTR","HOOD","SOFI","AFRM","UPST","LMND","ROOT","JOBY","ACHR","XPEV","NIO","LI","RIVN","LCID","SLDP","MVST","CHPT","BLNK","EVGO","STEM","FLNC","SHLS","RKLB","ASTS","LUNR","PL","BKSY","SPIR","SATL","MNTS","TME","FUTU","TIGR","QFIN","LX","FINV","WB","VIPS","DOYU","HUYA","JOYY","BLKB","LOGI","SPOT","U","RBLX","DKNG","PENN","GENI","RSI","PLTK","MAPS","ACVA","YOU","MIND","VRNS","SAIL","S","CRWD","PANW","ZS","OKTA","NET","FTNT","TENB","RPD"],
  },
  software: {
    label: "Software",
    tickers: ["MSFT","ORCL","CRM","ADBE","INTU","NOW","WDAY","ADSK","TEAM","HUBS","SNOW","MDB","GTLB","FROG","MNDY","ASAN","FRSH","BRZE","PCOR","BILL","APPN","DOMO","PRGS","BLZE","IBM","SAP","SSNC","OTEX","VEEV","MANH","SNPS","CDNS","PTC","PEGA","NICE","VRNT","GWRE","APPF","NCNO","ALKT","QTWO","TOST","CWAN","SPSC","JKHY","PAYC","PCTY","ADP","PAYX","WEX","TNET","GPN","FIS","FISV","GDOT","EVTC","PAYO","FLYW","RPAY","DT","ESTC","PD","BLKB","RAMP","TTGT","ZETA","TTD","APP","DV","IAS","MGNI","PUBM","CRTO","PERI","SHOP","WIX","ETSY","EBAY","REAL","TASK","ACN","CTSH","INFY","WIT","GLOB","EPAM","EXLS","G","CNXC","HURN","FCN","FORR","COUR","CHGG","DUOL","LAUR","PRDO","TWLO","ZM","RNG","FIVN","EGHT","LPSN","BAND","DOCS","OMCL","MDRX","HSTM","PHR","PRVA","HQY","TDOC","AMWL","OPRX","CLOV","HIMS","LOGI","SPOT","U","RBLX","TTWO","EA","DKNG","PENN","GENI","RSI","PLTK","MAPS","ACVA","CARG","CARS","ZG","OPEN","NTNX","MSTR","CERT","EGAN","YEXT","ALRM","MSCI","VRSK","SPGI","MCO","FDS","IT","TRI","SE","MELI","GRAB","RDDT","COIN","HOOD","SOFI","AFRM","UPST","LMND","ROOT"],
  },
  fintech: {
    label: "Fintech",
    tickers: ["V","MA","PYPL","ADYEY","FISV","FIS","GPN","WEX","AXP","SYF","COF","ALLY","AFRM","UPST","SOFI","HOOD","COIN","MSTR","MARA","RIOT","HUT","CLSK","CIFR","IREN","BTBT","BTDR","IBKR","LPLA","RJF","SCHW","AMTD","FUTU","UP","TIGR","PAYO","FLYW","EVTC","RPAY","OMF","ENVA","LDI","RKT","UWM","PFSI","ESNT","NMIH","MTG","LMND","ROOT","HIPO","GOCO","EHTH","SLQT","QNST","EVO","DKNG","PENN","RSI","GENI","GAMB","MAPS","TPVG","ARCC","MAIN","HTGC","GBDC","FSK","BXSL","OBDC","BX","KKR","APO","CG","ARES","TPG","HLNE","STEP","EVR","HLI","PJT","LAZ","PIPR","SF","VIRT","MKTX","ICE","CME","CBOE","NDAQ","NCNO","ALKT","QTWO","APPF","TOST","CWAN","JKHY","BANC","FCNCA","FFIN","SFBS","EWBC","WAFD","COLB","CVBF","BANR","NWBI","BUSE","WSFS","NBTB","LADR","KREF","GPMT","TRTX","BXMT","ARI","RC","RWT","BRSP","CHMI","TWO","AGNC","NLY","MFA","RITM","PMT","MITT","CMTG","ACR","FBRT","AFCG","DX","EFC","EARN","OFS","SCM","FDUS","WHF","HRZN","PNNT","GAIN","GLAD","PSEC","OXSQ","PFLT","NXRT","QFIN","LX","CNF","FINV"],
  },
  cybersecurity: {
    label: "Cybersecurity",
    tickers: ["CRWD","PANW","FTNT","ZS","OKTA","S","CHKP","TENB","RPD","VRNS","QLYS","GEN","OSPN","SAIL","NET","AKAM","RDWR","CACI","LDOS","SAIC","BAH","NTNX","VRNT","ITRI","TTEC","EPAM","ATEN","NTGR","CSCO","FFIV","ANET","VIAV","CIEN","ADTN","EXTR","NTAP","ORCL","IBM","MSFT","GOOGL","AMZN","META","DDOG","ESTC","FIVN","NOW","WDAY","PLTR","BB","DGII","CAMP","LPSN","AVAV","DLB","BLKB","HURN","EXLS","CNXC","G","ACN","CTSH","WIT","INFY","GLOB","PEGA","NICE","VRNT","MSCI","VRSK","TRI","SPGI","MCO","FDS","PAYC","PCTY","ADP","PAYX","WEX","EVO","FLYW","LQDT","KLAC","LRCX","AMAT","TER","FORM","ACMR","COHU","ICHR","MKSI","ENTG","SNPS","CDNS","PTC","MANH","HUBS","FRSH","BRZE","GTLB","FROG","DOMO","APPN","PCOR","TEAM","MNDY","ASAN","MSTR","PRGS","RDDT","DUOL","COIN","PATH","AI","BBAI","SOUN","ARQQ","QBTS","IONQ","RGTI","QUBT","LUNR","RKLB","ASTS","MNTS","SPCE","JOBY","ACHR","EVTL","FLNC","STEM","SHLS","BE","PLUG","FCEL","BLDP","SLDP","MVST","OPEN","LMND","ROOT","HIPO","CWAN","YOU","PRCT","TASK","DT","ESTC","OTEX","AVGO","STX","WDC"],
  },
  growth_stocks: {
    label: "Growth Stocks",
    tickers: ["NVDA","TSLA","AMZN","META","NFLX","GOOGL","MSFT","AAPL","AMD","AVGO","LLY","NVO","CRWD","PANW","NOW","SNOW","DDOG","MDB","NET","ZS","PLTR","PATH","AI","GTLB","FROG","MNDY","ASAN","HUBS","FRSH","BRZE","PCOR","RDDT","DUOL","APP","TTD","RBLX","U","DKNG","CELH","ONON","LULU","DECK","CROX","ANF","WOLF","LRCX","AMAT","KLAC","MRVL","ON","MPWR","ENTG","MKSI","ACMR","SMCI","VRT","TMDX","ISRG","DXCM","PODD","IRTC","INSP","ATRC","GKOS","NVCR","NTRA","BEAM","CRSP","NTLA","RXRX","SDGR","VRTX","MRNA","REGN","ILMN","VEEV","DOCS","HIMS","PGNY","AXSM","BHVN","INVA","TARS","CORT","HALO","ARWR","ARVN","RNA","TWLO","ZM","PAYC","PCTY","WDAY","BILL","PAYO","FLYW","EVTC","RPAY","DT","ESTC","PD","APPN","EGAN","PRGS","DOMO","CWAN","TASK","FLNC","STEM","SHLS","FSLR","ENPH","RUN","ARRY","COIN","MSTR","HOOD","SOFI","AFRM","UPST","OPEN","LMND","ROOT","HIPO","RIVN","LCID","CHPT","BLNK","EVGO","WKHS","HYLN","JOBY","ACHR","IONQ","QBTS","RGTI","QUBT","ARQQ","BFLY","PRCT","PRVA","HQY","PHR","AMKR","ONTO","AZTA","UCTT","ACLS","AEHR","PI","SLAB","FORM","AMBA","SYNA","SITM","ALGM","KYMR","IMVT","PRAX","SRRK","BCYC","NUVB","ALLO","TELA","AXSM","HRMY","SUPN","ACAD","RARE","ALNY","SRPT","PTCT","ROIV","RLAY","RCUS","MGNX","SGMO","XENE","LEGN","TGTX","IMCR","JANX","KALA","ANAB","SPRY","AGIO","TBPH","ZNTL","ARQT","CABA","CRNX","GOSS","AKBA","MNKD","ABCL","TWST","XPEV","NIO","LI","PSNY"],
  },
  dividend_aristocrats: {
    label: "Dividend Aristocrats",
    tickers: [],
  },
  semiconductors: {
    label: "Semiconductors",
    tickers: ["NVDA","AVGO","TSM","ASML","AMD","QCOM","TXN","INTC","AMAT","LRCX","KLAC","MRVL","ON","MPWR","MCHP","NXPI","ADI","STM","GFS","MU","ENTG","MKSI","SNPS","CDNS","SMCI","VRT","SWKS","QRVO","CRUS","SLAB","SYNA","SITM","ALGM","DIOD","RMBS","SMTC","AMBA","WOLF","PI","FORM","ACMR","ACLS","ONTO","COHU","ICHR","UCTT","AEHR","CEVA","AMKR","AZTA","KEYS","TER","IFNNY","AMS","LSCC","AEIS","IPGP","LITE","VIAV","MTSI","NVEC","IMOS","HIMX","NEON","OLED","KLIC","HLIT","POWI","LFUS","SANM","PLXS","FLEX","CLS","JBL","APH","TEL","HUBB","ROG","CRS","NVT","ATKR","GTLS","ALRM","DGII","CAMP","NICE","PERI","MTLS","SSYS","DDD","NNDM","GFAI","KULR","SPSC","QTWO","APPF","YEXT","PLTK","NCNO","ALKT","TOST","BLZE","INDI","OUST","LIDR","INVZ","LAZR","MVIS","AEVA","SNAP","MAPS","SPWR","JKS","CSIQ","ARRY","SHLS","SEDG","ENPH","FSLR","CWEN","ORA","AMRC","BE","PLUG","FCEL","BLDP","SLDP"],
  },
  cloud_computing: {
    label: "Cloud Computing",
    tickers: ["MSFT","AMZN","GOOGL","ORCL","CRM","NOW","SNOW","DDOG","NET","MDB","ESTC","DT","PD","TEAM","MNDY","ASAN","HUBS","FRSH","BRZE","PCOR","APPN","WDAY","INTU","ADSK","SNPS","CDNS","PTC","MANH","VEEV","BILL","GTLB","FROG","DOMO","PAYC","PCTY","ADP","PAYX","GWRE","APPF","YEXT","ALRM","BAND","TWLO","ZM","RNG","EGHT","FIVN","NICE","VRNT","IBM","NTAP","NTNX","ZS","OKTA","CRWD","PANW","FTNT","VRNS","SAIL","TENB","RPD","AKAM","FFIV","ANET","CSCO","SSNC","EPAM","ACN","CTSH","WIT","INFY","GLOB","PEGA","BLKB","SPSC","QTWO","NCNO","ALKT","TOST","CWAN","TASK","TTGT","ZETA","TTD","APP","DV","IAS","MGNI","PUBM","CRTO","PERI","ZG","OPEN","CARG","CARS","WEX","LPSN","BAND","PRGS","CLBT","PATH","AI","PLTR","BBAI","SOUN","GFAI","RDDT","DUOL","CHGG","COUR","LAUR","PRDO","IDAI","SAP","IONQ","QBTS","RGTI","ARQQ","YOU","TTEC","SAIC","CACI","BAH","LDOS","DOCS","HIMS","PGNY","PHR","OMCL","TDOC","AMWL","OPRX","CLOV","MDRX","HSTM","PRVA","HQY"],
  },
  defense: {
    label: "Defence",
    tickers: ["LMT","RTX","NOC","GD","BA","HII","LHX","TXT","HEI","TDG","AXON","KTOS","DRS","LDOS","SAIC","BAH","CACI","AVAV","PLTR","BWXT","CW","AIR","NPK","DXC","TTEC","EPAM","ICFI","CPI","BAESY","RKLB","SPCE","LUNR","ASTS","MNTS","PL","BKSY","SPIR","SATL","POWW","SWBI","RGR","VRRM","SSTI","BBAI","CIEN","CAMP","DGII","ALCO","AMMO","GEO","CXW","YOU","TTOO","SAFE","CEVA","CRSR","GHM","CRS","KALU","ATI","HXL","ESLT","IAI","RHM","GRC","JKHY","GPN","WEX","HURN","FCN","FORR","G","CNXC","EXLS","SNX","CDW","AMSC","POWL","ERII","PESI","ENS","BWEN","ESAB","FLOW","SPXC","ARLO","NTGR","SMTC"],
  },
  cannabis: {
    label: "Cannabis",
    tickers: [],
  },
} as const;

// "All Companies" = every sector's tickers, deduped. Added as the default option.
export const RADAR_ALL_KEY = "all";
const RADAR_ALL_COMPANIES_TICKERS = Array.from(
  new Set(Object.values(RADAR_SECTORS).flatMap((s) => s.tickers))
);
RADAR_SECTORS[RADAR_ALL_KEY] = {
  label: "All Companies",
  tickers: RADAR_ALL_COMPANIES_TICKERS,
};

// "All Companies" first, then the sectors in their declared order
export const RADAR_SECTOR_KEYS = [
  RADAR_ALL_KEY,
  ...Object.keys(RADAR_SECTORS).filter((k) => k !== RADAR_ALL_KEY),
];

// ─── Radar ranking + timeframe controls ───────────────────
export type RadarRanking = "default" | "gainers" | "losers" | "trending";

export const RADAR_RANKINGS: { key: RadarRanking; label: string }[] = [
  { key: "default", label: "Default" },
  { key: "gainers", label: "Top Gainers" },
  { key: "losers", label: "Top Losers" },
  { key: "trending", label: "Top Trending" },
];

// Daily only for now; structured so 1W/1M/etc. can be added later.
export const RADAR_TIMEFRAMES: { key: string; label: string }[] = [
  { key: "1d", label: "Today" },
  { key: "1w", label: "1W" },
  { key: "1m", label: "1M" },
  { key: "3m", label: "3M" },
  { key: "ytd", label: "YTD" },
  { key: "1y", label: "1Y" },
];

// Top-N shown for ranked views, and the cap for the unranked "All Companies" view
export const RADAR_RANKING_LIMIT = 50;
export const RADAR_ALL_DEFAULT_CAP = 100;

export const RADAR_ETF_CATEGORIES: Record<string, { label: string; tickers: string[] }> = {
  broad_market: {
    label: "Broad Market & Index",
    tickers: ["SPY","IVV","VOO","VTI","ITOT","SCHB","QQQ","QQQM","DIA","IWM","IWB","IWV","VB","VBK","VBR","VO","VOT","VOE","VV","MGK","MGV","RSP","EUSA","SCHX","SCHA","SCHM","IVW","IVE","VUG","VTV"],
  },
  etf_technology: {
    label: "Technology",
    tickers: ["XLK","VGT","IYW","FTEC","SMH","SOXX","SOXQ","NVDL","USD","PSI","AIQ","BOTZ","ROBT","IRBO","ARKQ","WCLD","SKYY","CLOU","BUG","CIBR","HACK","IHAK","IGV","PSJ","FINX","IPAY","BLOK","BKCH","ARKW","ARKK"],
  },
  etf_healthcare: {
    label: "Healthcare",
    tickers: ["XLV","VHT","IYH","FHLC","IBB","XBI","BBH","ARKG","GNOM","PTH","IHI","MEDI","RXL","GDNA","IDNA","PSCH","IHE","PJP","IHF","HTEC"],
  },
  etf_financials: {
    label: "Financials",
    tickers: ["XLF","VFH","IYF","FNCL","KBE","KRE","IAT","KBWB","KBWR","KIE","IAK","KCE","IAI","FINX","IPAY","BLOK","MOFG","BIZD","PFFD","PGX"],
  },
  etf_energy: {
    label: "Energy",
    tickers: ["XLE","VDE","IYE","FENY","XOP","OIH","XES","AMLP","AMJ","MLPA","MLPX","ENFR","TPYP","ICLN","QCLN","ACES","SMOG","CNRG","FAN","TAN"],
  },
  etf_consumer: {
    label: "Consumer",
    tickers: ["XLY","XLP","VCR","VDC","IYC","IYK","FDIS","FSTA","PSCD","PSCC","RTH","XRT","PMR","IBUY","ONLN","PBJ","MOO","BITE","AWAY","PEJ"],
  },
  etf_industrials_materials: {
    label: "Industrials & Materials",
    tickers: ["XLI","XLB","VIS","VAW","IYJ","IYM","FIDU","FMAT","XAR","ITA","PPA","DFEN","XTN","IYT","FTXR","PAVE","IGF","IFRA","GNR","GUNR"],
  },
  etf_real_estate: {
    label: "Real Estate",
    tickers: ["VNQ","IYR","XLRE","SCHH","RWR","REM","RFI","NETL","INDS","HOMZ","REZ","STOR","SRVR","PPTY","KBWY","FFR","IFGL","VNQI","RWX","WPS"],
  },
  international_global: {
    label: "International & Global",
    tickers: ["VEA","VEU","VT","VXUS","EFA","IEFA","SCHF","VWO","EEM","IEMG","SCHE","FXI","KWEB","MCHI","EWJ","DXJ","DBJP","EWG","EWU","EWC","EWA","EWZ","EWW","EWY","EWT","INDA","INDY","SMIN","EZA","EMXC"],
  },
  fixed_income: {
    label: "Fixed Income & Bonds",
    tickers: ["BND","AGG","SCHZ","BIV","BSV","BLV","IEF","SHY","TLT","TLH","GOVT","VGIT","VGLT","VGSH","TIPS","VTIP","SCHP","LQD","VCIT","VCSH","VCLT","USIG","HYG","JNK","USHY","SHYG","MBB","VMBS","MUB","VTEB"],
  },
  commodities: {
    label: "Commodities & Alternatives",
    tickers: ["GLD","IAU","GLDM","SGOL","SLV","SIVR","PPLT","PALL","GDX","GDXJ","SIL","SILJ","USO","BNO","UNG","UCO","DBO","DBB","DBP","DBC","PDBC","COMT","COMB","GSG","WEAT","CORN","SOYB","CANE","WOOD","REMX"],
  },
  dividend_income: {
    label: "Dividend & Income",
    tickers: ["VYM","DVY","HDV","SCHD","DGRO","VIG","DGRW","SDY","NOBL","REGL","SMDV","DIV","SDIV","IDV","VYMI","FVD","RDIV","PEY","SPHD","SPYD"],
  },
  factor_smart_beta: {
    label: "Factor & Smart Beta",
    tickers: ["MTUM","QUAL","SIZE","VLUE","USMV","EFAV","EEMV","ACWV","LRGF","INTL","VFMF","VFMO","VFQY","VFVA","VFLQ","SPLV","XSLV","XMLV","SPHQ","SPMO"],
  },
  thematic_megatrend: {
    label: "Thematic & Megatrend",
    tickers: ["ARKK","ARKG","ARKW","ARKQ","ARKF","ARKX","BOTZ","AIQ","IRBO","ROBO","LIT","BATT","DRIV","KARS","IDRV","ECAR","ICLN","ACES","ERTH","VCAR","METV","UFO","ROKT","MOON","YOLO","MJ","MSOS","HERO","ESPO"],
  },
  leveraged_inverse: {
    label: "Leveraged & Inverse",
    tickers: ["TQQQ","SQQQ","QLD","PSQ","SPXL","SPXS","UPRO","SH","SDS","SSO","SOXL","SOXS","TECL","TECS","FNGU","FNGD","LABU","LABD","TNA","TZA","NUGT","DUST","UCO","SCO","TMF","TMV","TBF","UVXY","SVXY","VIXY"],
  },
} as const;

export const RADAR_ETF_CATEGORY_KEYS = Object.keys(RADAR_ETF_CATEGORIES);

// Deduped ETF universe for the Alerts "ETF MA crossings" panel. Drawn from every
// RADAR category except `leveraged_inverse` — those funds flip above/below their
// moving averages constantly and would swamp the recent-crossings list with noise.
export const ETF_UNIVERSE: string[] = Array.from(
  new Set(
    Object.entries(RADAR_ETF_CATEGORIES)
      .filter(([key]) => key !== "leveraged_inverse")
      .flatMap(([, cat]) => cat.tickers)
  )
);
