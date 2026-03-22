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
    tickers: ["XOM","CVX","COP","SLB","EOG","MPC","PSX","VLO","PXD","DVN","HAL","BKR","OXY","HES","FANG","MRO","APA","CTRA","OVV","SM","MTDR","PARR","PDCE","CLR","CRC","CPE","ESTE","REI","BATL","SWN","RRC","EQT","CNX","AR","CDEV","TELL","LNG","CQP","NFG","SWX","SPTN","OKE","KMI","WMB","ET","EPD","MMP","PAA","TRGP","DCP","MPLX","PBFX","CEQP","NBLX","AM","EE","GEL","NS","SRLP","CCLP","WES","HESM","RTLR","PBF","DKL","DK","HFC","CLMT","INT","CHK","DNR","SD","GPOR","SRCI","NOG","VTLE","WTI","BORR","VAL","NCSM","OIS","RES","ACDC","PTEN","NBR","HP","KLXE","PUMP","WTTR","NR","USAC","NGAS","ARCH","CEIX","BTU","ARLP","AMR","METC","COKE","FUELCELL","PLUG","BE","CLNE","HYZON","RUN","NOVA","SPWR","FSLR","ENPH","SEDG","ARRY","CSIQ","JKS","MAXN","DAQO","SHLS","NEP","AY","CWEN","EVA","GPRE","REX","VGAS","RIG","DO","ESV","RDC","SDRL","PACD"],
  },
  information_technology: {
    label: "Information Technology",
    tickers: ["AAPL","MSFT","NVDA","META","GOOGL","GOOG","AVGO","ORCL","CRM","AMD","INTC","QCOM","TXN","IBM","NOW","INTU","AMAT","MU","LRCX","KLAC","ADI","MRVL","SNPS","CDNS","PANW","FTNT","CRWD","PLTR","ADSK","TEAM","WDAY","SNOW","DDOG","ZS","OKTA","HUBS","SMAR","COUP","BILL","TTWO","EA","RBLX","U","DKNG","NET","MDB","ESTC","FROG","GTLB","S","ANET","FFIV","JNPR","CSCO","HPQ","HPE","DELL","STX","WDC","NTAP","PSTG","VCNX","ACN","CTSH","WIT","INFY","IT","EPAM","GLOB","EXLS","CACI","SAIC","BAH","LDOS","GEN","CYBR","TENB","RPD","VRNS","QLYS","SAIL","OSPN","MIME","SCWX","CHKP","NLOK","PFPT","FEYE","IMPV","BCOV","ANGI","CARS","TRUE","CDW","PCYC","SMCI","GFS","ON","MPWR","WOLF","DIOD","RMBS","SLAB","SWKS","QRVO","CRUS","FORM","ACMR","COHU","ICHR","MKSI","ENTG","CCMP","CY","MCHP","NXPI","STM","IFNNY","ASML","AEHR","PI","ACLS","ONTO","UCTT","RBBN","VIAV","CIEN","INFN","LITE","IIVI","NPTN","FNSR","APH","TEL","KEYS","TDY","ITRI","VNET","NTES","BIDU","JD","PDD","BABA","TCOM","WB","VIPS","QFIN","LUMN","SIFY","SYMC","PFGC","PRFT","CEVA","BLKB","EVBG","FIVN","NICE","SPSC","PCTY","PAYC","ADP","PAYX","GWRE","APPF","YEXT","ALRM","BAND","TWLO","SEND","MSGN","ZM","RNG","EGHT","ATNI","LPSN","SNCR","TTEC","XRX","PERI","DV","IAS","MGNI","PUBM","TTD","APP","APPS","IRBT","CGNX","ISRG","NUAN","PEGA","BRCD","RBBN","SMTC","AMBA","SYNA","IDEX","AZPN","PTC","ANSS","ESI","MSCI","VRSK","TRI","SPGI","MCO","FDS"],
  },
  financials: {
    label: "Financials",
    tickers: ["BRK.B","JPM","V","MA","BAC","WFC","GS","MS","C","AXP","BLK","SCHW","CB","MMC","AON","MET","PRU","AIG","PGR","ALL","TRV","HIG","AFL","L","RE","RNR","AJG","WTW","RYAN","BRP","USB","PNC","TFC","COF","DFS","SYF","ALLY","CIT","FITB","RF","CFG","HBAN","KEY","MTB","FRC","SIVB","WAL","CMA","ZION","BOKF","EWBC","PACW","GBCI","UMBF","SNV","FFIN","IBCP","NBTB","SBCF","STEL","FHN","IBOC","STBA","FFBC","SPFI","FBIZ","SFBS","LKFN","CBTX","TBNK","SPWH","FSBW","BX","KKR","APO","CG","ARES","BAM","BN","TPG","HLNE","STEP","FNF","FAF","STC","ITIC","ICE","CME","CBOE","NDAQ","MKTX","VIRT","HOOD","IBKR","AMTD","LPLA","RJF","SF","PJT","EVR","LAZ","MOELIS","MC","HLI","PIPR","FHI","AMG","IVZ","EV","VRTS","WDR","CLMS","DHIL","GCMG","CSWC","ARCC","FS","GBDC","HTGC","MAIN","TPVG","PSEC","GAIN","GLAD","OXSQ","PFLT","FSK","BXSL","OBDC","ORCC","SSSS","TICC","OFS","MRCC","KCAP","SLRC","FDUS","SCM","WHF","HRZN","CPTA","BCSF","SUNS","SLSS","AINV","PNNT","FNB","NBT","ACNB","CHMG","BWFG","ESSA","PBIP","NWIN","PEBO","HTBK","COLB","PPBI","CVBF","WAFD","BANR","NWBI","CASH","SMBC","STBA","LCNB","BUSE","TRMK","SBSI"],
  },
  health_care: {
    label: "Health Care",
    tickers: ["UNH","JNJ","LLY","ABT","MRK","TMO","DHR","AZN","NVO","PFE","ABBV","BMY","AMGN","GILD","BIIB","REGN","VRTX","MRNA","BNTX","ILMN","IDXX","EW","STE","MTD","WST","RMD","ALGN","COO","HOLX","BAX","BDX","BSX","MDT","SYK","ZBH","HSIC","PDCO","DVA","HUM","CVS","CI","ELV","CNC","MOH","HCA","THC","UHS","LPNT","AMEH","ACCD","DOCS","HIMS","ONEM","PHR","CANO","OSH","RXRX","SDGR","SEER","PACB","NSTG","BEAM","NTLA","EDIT","CRSP","FATE","KYMR","ARQT","IMVT","PRAX","ARVN","C4T","ZNTL","IMGO","CORT","HALO","EXAS","NTRA","VEEV","HEALTHA","HSTM","PGNY","ACGL","OMCL","QGEN","PKI","WAT","BRKR","SYNH","PRA","MEDP","ICLR","CRL","NEOG","ABMD","ATRC","SWAV","INSP","AXNX","NARI","TNDM","DXCM","PODD","GKOS","IRTC","MASI","NVCR","OCDX","AVNS","HAE","MMSI","ATEC","AMED","LHCG","ENSG","NHC","SEM","KND","ACHC","BHVN","SRRK","ARWR","RARE","FOLD","ACAD","AXSM","SUPN","HRMY","SIGA","PTGX","TARS","PRGO","ENDP","PAHC","PCRX","LNTH","EVGO","NKTR","MNTA","ANPC","VAPO","RGEN","MEDX","PRVA","OTRK","SGFY","GOCO","EHTH","HQY","OOMA","CRVS","TRVI","ADMA","AGEN","CLVS","ALEC","DAWN","IMMU","MNKD","SCPH","RSSS","EHC","CCRN","AMN","TBI","HCSG","PINC","GMED","NUVB","BCYC","ALLO","BLUE","SGMO","XENE","FUSN","RNA","VERV","TELA"],
  },
  consumer_discretionary: {
    label: "Consumer Discretionary",
    tickers: ["AMZN","TSLA","HD","MCD","NKE","LOW","SBUX","TJX","BKNG","MAR","GM","F","RIVN","LCID","RCL","CCL","LVS","MGM","WYNN","CZR","EXPE","ABNB","UBER","LYFT","DRI","YUM","CMG","WING","SHAK","TXRH","EAT","DENN","JACK","WEN","QSR","SONO","PTON","NLS","FTDR","SCI","HBI","PVH","RL","GOOS","TPR","CPRI","VFC","UAA","UA","LULU","ONON","BIRD","ANF","AEO","GPS","GES","SKX","CROX","DECK","SHOO","WWW","CAL","BBW","PLCE","BURL","ROST","M","KSS","JWN","PRTY","BBBY","PIR","W","ETSY","CHWY","PETS","WOOF","BIG","FND","LESL","SBH","ULTA","EL","RGS","REVG","PATK","LCII","THO","WGO","CWH","BC","MBUU","MCBC","MCFT","HOLI","MPX","FOXF","POWW","VSTO","SWBI","RGR","AOBC","STLA","TM","HMC","NSANY","BMWYY","VWAGY","DDAIF","RACE","NKLA","PCRFY","HYMLF","LEA","ALV","BWA","APTV","DAN","THRM","MODV","DRVN","ABG","LAD","AN","KMX","PAG","SAH","GPI","RUSHA","ORLY","AZO","AAP","GPC","LKQ","MNRO","SNA","MLM","NFLX","DIS","PARA","WBD","LYV","AMC","CNK","IMAX","MSGM","PENN","GDEN","RRR","FULL","CHDN","TRMR","GAMB","SOND","VACN","MTN","PLNT","XPOF","GFAI","BBY"],
  },
  consumer_staples: {
    label: "Consumer Staples",
    tickers: ["PG","KO","PEP","COST","WMT","PM","MO","CL","MDLZ","KMB","GIS","K","CPB","HRL","MKC","SJM","CAG","BGS","LANC","JJSF","SMPL","NOMD","AMBS","VITL","BRBS","CENT","CENTA","SPTN","CHEF","USFD","SFM","WFRD","KR","SWY","ACI","GO","CASY","MUSA","ATD","PTLO","HSY","TWNK","RMCF","FRPT","HAIN","ALPN","INGR","DNKN","JAH","ENR","REYN","IPAR","EL","COTY","REV","ELF","PLBY","SKIN","IRNT","NPKI","CLX","CHD","SP","HELE","PBH","POST","TAP","BUD","SAM","ABEV","FMX","MNST","CELH","REED","FIZZ","COKE","KDP","CCEP","OTLY","BRBR","NU","USANA","PLNT","BTI","TPB","XXII","VGR","STZ","MGPI","MOND","ADM","BG","CALM","LWAY","BRFS","JBSS","SENEA","SEB","TSN","PPC","SAFM","WH","CHH","IHG","GPRO","IOTS","NAT","PRPL","SNBR","TPX","LOGI","GRMN","KNSL","EG"],
  },
  industrials: {
    label: "Industrials",
    tickers: ["RTX","HON","UPS","BA","CAT","DE","GE","MMM","ETN","EMR","FDX","LMT","NOC","GD","HII","LHX","TXT","HEI","TDG","SPR","AXON","KTOS","MOOG","DRS","AER","AL","AAL","DAL","UAL","LUV","ALK","SAVE","HA","JBLU","SKYW","MESA","CSX","NSC","UNP","CP","CNI","KSU","WAB","TRN","RAIL","GBX","RXO","XPO","CHRW","EXPD","ECHO","FWRD","SAIA","ODFL","ARCB","MRTN","HTLD","KNX","WERN","JBHT","LSTR","HUBG","CVLG","DSKE","ATSG","AAWW","GATX","GFF","PH","IR","GNRC","AOS","WTS","FELE","REXN","REX","SPXC","FLOW","BWXT","JBT","HLIO","CECO","MWA","NWN","LAYN","GVP","ITT","AMETEK","ROP","LDOS","CACI","MANT","DLB","VPG","OFLX","NWPX","WDFC","CFX","KAR","RBA","IAA","CPRT","MNDT","CLBT","SLAB","OSK","PCAR","CMI","AGCO","LNN","CNHI","TEX","MTW","ALG","REVG","HRI","URI","TREX","BECN","BLDR","MAS","MHK","AWI","USCR","VMC","FMSA","SUM","EXP","USLM","RGLD","NVT","GNSS","ARAY","PKOH","KBAL","STRT","SXI","ESE","TWIN","CPLG","JELD","DOOR","FBHS","SSD","PGTI","AMWD","AZEK","CSTE","GRBK","LGIH","MDC","TMHC","TPH","SKY","UCP","CCS","CVCO","LEGH"],
  },
  materials: {
    label: "Materials",
    tickers: ["LIN","APD","SHW","NEM","FCX","NUE","PPG","ECL","DD","DOW","LYB","EMN","CE","CF","MOS","IFF","FMC","ALB","CTLT","AVTR","RPM","AXTA","HUN","OLN","ASH","TROX","CC","VNTR","IOSP","MEOH","BCPC","UNVR","GCP","WLK","ARCH","HCC","CEIX","METC","BTU","ARLP","X","CLF","MT","STLD","RS","WOR","ZEUS","KALU","CENX","AA","ACH","CSTM","KRO","TG","HL","CDE","PAAS","MAG","AG","SILV","FSM","SSRM","EGO","IAG","KGC","AUY","GOLD","AEM","FNV","WPM","RGLD","OR","SAND","MTA","AUMN","GPL","MUX","GFI","AU","HMY","DRDGOLD","SIBR","IVN","SBSW","PLZL","ANGPY","BHP","RIO","VALE","TECK","SCCO","FM","GLNCY","AGLXY","VMC","MLM","SUM","EXP","USLM","USCR","CRH","EBF","CX","FYBR","PKG","IP","WRK","SLGN","ATR","SON","BERY","SEE","AMBP","ARD","BALL","CCK","CANSF","OI","MERC","UFP","LGND","CLW","PW","UFPI","LPX","OSB","BECN","BLDR","AMWD","MAS","AWI","TREX","CSL","GMS","IBP","PGTI","AZEK","JELD","DOOR","FBHS","SSD","NX","CSTE","TILE","MHK","FLXS","WLKP","CRYF","PERY","AMKR","ONTO","AZTA","BRKS"],
  },
  utilities: {
    label: "Utilities",
    tickers: ["NEE","DUK","SO","D","AEP","EXC","XEL","PCG","ED","WEC","ES","ETR","PPL","DTE","AEE","CMS","CNP","NI","LNT","PNW","EVRG","OGE","IDA","AVA","NWE","OTTR","MDU","BKH","MGEE","POR","HE","GXP","EIX","SRE","AWK","WTRG","MSEX","YORW","ARTNA","CWCO","PESI","UTL","SPKE","HASI","BEP","BEPC","TERP","NYLD","PEGI","REGI","ORA","AMRC","NOVA","ARRY","AMPS","GLOW","FE","NRG","VST","TLNE","ENEL","ELP","CIG","SBS","PAM","TGS","EDN","CEL","VIV","ENGI","CPFE","GAS","SR","SWX","NWN","ATG","LABL","NFG","UGI","APU","SPH","GLP","MGAS","CLNC","CORR","MIC","AWR","GWRS","CLFD","ERII","PRTC","CDZI","SJW","ARIS","PURE","TNC","PTE","ATGN","ELLO","VER","NEP","CWT","GCP","BWEN","EAF","GPRE","AZRE","DNNGY","IBDRY","ESOCF","ENGIY","RWEOY","EOAN","FTS","H","EMA","AQN","BIP","BIPC","TELSA"],
  },
  real_estate: {
    label: "Real Estate",
    tickers: ["PLD","AMT","EQIX","CCI","SPG","WELL","DLR","PSA","EXR","O","VICI","IRM","AVB","EQR","MAA","UDR","CPT","NNN","ADC","STAG","REXR","EGP","TRNO","LXP","COLD","FR","DRE","PTRS","CUBE","NSA","LSI","SELF","REG","KIM","BRX","ROIC","SITC","RPAI","WPG","CBL","MAC","PEI","SRG","PREIT","VNO","SLG","BXP","DEI","CLI","CUZ","HIW","EQC","OFC","PGRE","CLDT","RHP","HST","PK","SHO","APLE","SLMN","XHR","HT","BHR","INN","RLJ","PLYM","ILPT","AHH","NXRT","IRT","ELME","NVCR","FCPT","SVC","OPI","HPP","JBGS","CXW","GEO","RADI","SBAC","UNIT","AMH","INVH","TMPL","NWHM","GTLS","STRS","FRPH","UE","GNL","AFIN","PINE","EPRT","NTST","PSTL","GIPR","BRSP","TPGY","MHO","GRBK","LGIH","CCS","TMHC","BZH","WLH","HOV","CVCO","SKY","UCP","LEGH","KBH","MDC","NVR","DHI","LEN","PHM","TOL","MHC","ELS","SUI","UMH","IIIV","WSFS","SLQT","LADR","ACR","KREF","GPMT","TRTX","BXMT","AFCG","FBRT","CLNC","CLNS","ARI","MRC","RC","CHMI","RWT","BRMK","HCFT","QNST","LMND","HIMAX"],
  },
  communication_services: {
    label: "Communication Services",
    tickers: ["META","GOOGL","NFLX","DIS","CMCSA","T","VZ","TMUS","CHTR","WBD","PARA","FOX","FOXA","LYV","OMC","IPG","NWSA","NWS","NYT","NLSN","SNAP","PINS","MTCH","BMBL","GRINDR","MQ","ZG","Z","IAC","ANGI","CARS","TRUE","CARG","CDK","HMST","TTGT","ZETA","PUBM","MGNI","TTD","CRTO","IAS","DV","GOOG","YELP","TRIP","OPEN","RDFN","REAL","POSH","MELI","SE","GLOB","LPSN","BAND","TWLO","MSGN","MSGS","SPXC","CCI","AMT","SBAC","UNIT","TIGO","LILA","LILAK","ATUS","CABO","WOW","CCOI","GTT","CNSL","LUMN","TDS","USM","SHEN","GNCMA","IRDM","VSAT","GSAT","ORB","SPCE","RKLB","ASTR","MNTS","ASTS","GILT","HSAT","DISH","SIRI","IHRT","ETM","NXST","SBGI","GTN","TEGN","SSP","MWIV","SALM","EMMS","CIDM","LPLA","AMC","AMCX","MSG","NCMI","RGS","MPLX","PNTV","DRNA","SPOT","PTON","DKNG","PENN","RSN","CDAY","PRSP","K12","CHGG","LAUR","2U","ATGE","PRDO","GHC","LINC","COUR","UDMY","DUOL","EDX","APEI","NUAN","NICE","EVERI","LTRPA","FWMK","BRZE","SPRK","FROG"],
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
