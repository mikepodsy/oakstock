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
    tickers: ["NVDA","MSFT","GOOGL","META","AMZN","IBM","ORCL","PLTR","PATH","AI","BBAI","SOUN","GFAI","IONQ","QBTS","RGTI","ARQQ","QUBT","RXRX","SDGR","ABSI","TWST","NUAN","NICE","VRNT","PEGA","SYM","MBLY","LAZR","MVIS","VLDR","AEVA","OUST","INVZ","LIDR","INDI","MTTR","KSCP","AISP","CXAI","GIGA","ARBB","AIXI","AIOT","RBOT","ISRG","PRCT","BFLY","DDOG","SNOW","MDB","CFLT","ESTC","DT","SPLK","NEWR","SUMO","PD","ANSS","ALTR","AZPN","PTC","SNPS","CDNS","MSCI","VRSK","SPGI","MCO","FDS","DNB","IT","TTGT","ZETA","RAMP","TTD","APP","DV","IAS","MGNI","PUBM","CRTO","PERI","RDDT","ZI","MNTV","SVMK","ACVA","CARG","ZG","OPEN","RDFN","CDK","DOCS","HIMS","PGNY","ACCD","PHR","OMCL","TDOC","AMWL","OPRX","CLOV","NTRA","EXAS","ILMN","PACB","BEAM","NTLA","CRSP","EDIT","SEER","NSTG","BIDU","JD","BABA","NTES","PDD","TCOM","IQ","BILI","SE","MELI","GRAB","DUOL","COUR","UDMY","CHGG","K12","ACN","CTSH","INFY","WIT","GLOB","EPAM","EXLS","G","CNXC","WNS","TASK","TRI","COIN","MSTR","HOOD","SOFI","AFRM","UPST","LMND","ROOT","JOBY","ACHR","XPEV","NIO","LI","RIVN","LCID","NKLA","SLDP","MVST","VLCN","IDEX","CHPT","BLNK","EVGO","STEM","FLNC","SHLS","RKLB","ASTS","LUNR","PL","BKSY","SPIR","SATL","MNTS","TME","FUTU","TIGR","QFIN","LUFAX","LX","FINV","CIFS","WB","VIPS","DOYU","HUYA","JOYY","BLKB","CSOD","LOGI","SPOT","U","RBLX","DKNG","PENN","GENI","RSI","EVERI","PLTK","MAPS","ACVA","YOU","MIND","VRNS","SAIL","CYBR","S","CRWD","PANW","ZS","OKTA","NET","FTNT","TENB","RPD"],
  },
  software: {
    label: "Software",
    tickers: ["MSFT","ORCL","CRM","ADBE","INTU","NOW","WDAY","ADSK","TEAM","HUBS","SNOW","MDB","CFLT","GTLB","FROG","MNDY","ASAN","SMAR","FRSH","BRZE","PCOR","COUP","BILL","APPN","DOMO","PRGS","ALTR","AMSWA","BASE","CLDR","TLND","BLZE","VMW","CTXS","IBM","SAP","SSNC","OTEX","VEEV","MANH","SNPS","CDNS","ANSS","PTC","AZPN","PEGA","NICE","VRNT","GWRE","APPF","NCNO","ALKT","QTWO","TOST","ENFN","CWAN","SPSC","JKHY","PAYC","PCTY","ADP","PAYX","CDAY","WEX","TNET","GPN","FIS","FISV","FLT","GDOT","EVTC","PAYO","FLYW","RPAY","DT","NEWR","ESTC","SPLK","SUMO","PD","BLKB","CSOD","SVMK","MNTV","ZI","RAMP","TTGT","ZETA","TTD","APP","DV","IAS","MGNI","PUBM","CRTO","PERI","SHOP","WIX","SQSP","ETSY","EBAY","BIGC","WISH","POSH","REAL","TASK","ACN","CTSH","INFY","WIT","GLOB","EPAM","EXLS","G","CNXC","WNS","PRFT","HURN","FCN","FORR","COUR","UDMY","CHGG","DUOL","K12","LAUR","2U","ATGE","PRDO","TWLO","ZM","RNG","FIVN","EGHT","LPSN","BAND","SNCR","AVLR","DOCS","OMCL","NXGN","MDRX","HSTM","PHR","ACCD","SGFY","PRVA","HQY","ONEM","TDOC","AMWL","OPRX","CLOV","HIMS","LOGI","SPOT","U","RBLX","TTWO","EA","DKNG","PENN","GENI","RSI","EVERI","PLTK","MAPS","ACVA","CARG","CDK","CARS","TRUE","ZG","OPEN","RDFN","NTNX","MSTR","CERT","EGAN","YEXT","ALRM","MSCI","VRSK","SPGI","MCO","FDS","DNB","IT","TRI","HCLTECH","LTIMIND","COFORGE","KPIT","PERSISTENT","OFSS","MASTECH","BIRLASOFT","CYIENT","NIIT","SE","MELI","GRAB","RDDT","COIN","HOOD","SOFI","AFRM","UPST","LMND","ROOT"],
  },
  fintech: {
    label: "Fintech",
    tickers: ["V","MA","PYPL","SQ","ADYEY","FISV","FIS","GPN","FLT","WEX","AXP","DFS","SYF","COF","ALLY","AFRM","UPST","SOFI","HOOD","COIN","MSTR","MARA","RIOT","HUT","BITF","CLSK","CIFR","IREN","BTBT","BTDR","IBKR","LPLA","RJF","SCHW","AMTD","FUTU","UP","TIGR","PAYO","FLYW","EVTC","RPAY","CURO","OMF","ENVA","LDI","GHLD","RKT","UWM","PFSI","COOP","ESNT","NMIH","MTG","LMND","ROOT","HIPO","GOCO","EHTH","SLQT","QNST","EVO","DKNG","PENN","RSI","GENI","GAMB","MAPS","TPVG","ARCC","MAIN","HTGC","GBDC","FSK","BXSL","OBDC","BX","KKR","APO","CG","ARES","TPG","HLNE","STEP","MOELIS","EVR","HLI","PJT","LAZ","PIPR","SF","VIRT","MKTX","ICE","CME","CBOE","NDAQ","NCNO","ALKT","QTWO","APPF","TOST","ENFN","CWAN","SS","JKHY","BANC","CBTX","FCNCA","FFIN","SFBS","EWBC","WAFD","COLB","PPBI","CVBF","BANR","HTBK","NWBI","BUSE","WSFS","NBTB","LADR","KREF","GPMT","TRTX","BXMT","ARI","RC","RWT","BRMK","BRSP","CLNC","MRC","CHMI","TWO","AGNC","NLY","MFA","RITM","PMT","MITT","WMC","NYMT","CMTG","HCFT","ACR","FBRT","AFCG","DX","EFC","ANH","EARN","KCAP","MRCC","OFS","SCM","FDUS","WHF","HRZN","CPTA","AINV","PNNT","GAIN","GLAD","PSEC","OXSQ","PFLT","NXRT","QFIN","LUFAX","LX","CNF","FINV","CIFS"],
  },
  cybersecurity: {
    label: "Cybersecurity",
    tickers: ["CRWD","PANW","FTNT","ZS","OKTA","S","CYBR","CHKP","TENB","RPD","VRNS","QLYS","GEN","SCWX","MIME","IMPV","PFPT","OSPN","NLOK","FEYE","SAIL","NET","AKAM","RDWR","CACI","LDOS","SAIC","BAH","NTNX","VRNT","TELOS","ITRI","TTEC","PRFT","EPAM","CTXS","ATEN","NTGR","JNPR","CSCO","FFIV","ANET","RBBN","VIAV","CIEN","INFN","ADTN","EXTR","COMM","NTAP","PSTG","ORCL","IBM","MSFT","GOOGL","AMZN","META","SPLK","DDOG","ESTC","SUMO","EVBG","FIVN","ZEN","NOW","SMAR","WDAY","PING","IDEX","PLTR","BB","AVST","DGII","CAMP","SNCR","LPSN","AVAV","KEYW","DLB","BLKB","HURN","EXLS","CNXC","G","ACN","CTSH","WIT","INFY","GLOB","PEGA","NICE","VRNT","NUAN","MSCI","VRSK","TRI","SPGI","MCO","FDS","DNB","CDAY","PAYC","PCTY","ADP","PAYX","WEX","EVO","FLYW","LQDT","KLAC","LRCX","AMAT","TER","FORM","ACMR","COHU","ICHR","MKSI","ENTG","SNPS","CDNS","ANSS","PTC","AZPN","MANH","HUBS","FRSH","BRZE","CFLT","GTLB","FROG","DOMO","ALTR","APPN","AMSWA","PCOR","TEAM","COUP","MNDY","ASAN","BASE","TLND","MSTR","PRGS","ZI","RDDT","DUOL","COIN","PATH","AI","BBAI","SOUN","ARQQ","QBTS","IONQ","RGTI","QUBT","LUNR","RKLB","ASTS","MNTS","SPCE","JOBY","ACHR","LILM","EVTL","TPIC","FLNC","STEM","SHLS","BE","PLUG","FCEL","BLDP","HYZON","NKLA","SLDP","MVST","OPEN","LMND","ROOT","HIPO","CWAN","YOU","PRCT","TASK","XPERI","DT","ESTC","NEWR","OTEX","AVGO","STX","WDC"],
  },
  growth_stocks: {
    label: "Growth Stocks",
    tickers: ["NVDA","TSLA","AMZN","META","NFLX","GOOGL","MSFT","AAPL","AMD","AVGO","LLY","NVO","CRWD","PANW","NOW","SNOW","DDOG","MDB","NET","ZS","PLTR","PATH","AI","CFLT","GTLB","FROG","MNDY","ASAN","HUBS","FRSH","BRZE","PCOR","ZI","RDDT","DUOL","APP","TTD","RBLX","U","DKNG","CELH","ONON","LULU","DECK","CROX","ANF","WOLF","LRCX","AMAT","KLAC","MRVL","ON","MPWR","ENTG","MKSI","ACMR","SMCI","VRT","TMDX","ISRG","DXCM","PODD","IRTC","SWAV","INSP","NARI","AXNX","ATRC","GKOS","MASI","NVCR","EXAS","NTRA","BEAM","CRSP","NTLA","RXRX","SDGR","VRTX","MRNA","REGN","ILMN","VEEV","DOCS","HIMS","PGNY","AXSM","BHVN","INVA","TARS","CORT","HALO","ARWR","ARVN","RNA","VERV","TWLO","ZM","CDAY","PAYC","PCTY","SMAR","WDAY","COUP","BILL","PAYO","FLYW","EVTC","RPAY","DT","NEWR","ESTC","SUMO","PD","AVLR","ALTR","APPN","EGAN","PRGS","DOMO","CWAN","TASK","FLNC","STEM","SHLS","FSLR","ENPH","RUN","NOVA","ARRY","MAXN","COIN","MSTR","HOOD","SOFI","AFRM","UPST","OPEN","LMND","ROOT","HIPO","RIVN","LCID","CHPT","BLNK","EVGO","WKHS","GOEV","HYLN","JOBY","ACHR","IONQ","QBTS","RGTI","QUBT","ARQQ","BFLY","PRCT","ONEM","SGFY","PRVA","HQY","ACCD","PHR","AMKR","ONTO","AZTA","BRKS","UCTT","ACLS","AEHR","PI","SLAB","FORM","AMBA","SYNA","SITM","ALGM","SWTX","KYMR","IMVT","DAWN","PRAX","SRRK","BCYC","NUVB","ALLO","FUSN","TELA","AXSM","HRMY","SUPN","ACAD","FOLD","RARE","ALNY","SRPT","PTCT","BPMC","KRTX","ROIV","RLAY","DICE","RCUS","IMMU","MGNX","BLUE","SGMO","XENE","LEGN","TGTX","MERUS","IMCR","JANX","KALA","ANAB","SPRY","AGIO","TBPH","ZNTL","ARQT","CABA","CRNX","GOSS","APLS","AKBA","MNKD","ABCL","TWST","XPEV","NIO","LI","PSNY","NKLA","RIDE","FFIE","ELMS","MULN","AYRO","SOLO"],
  },
  dividend_aristocrats: {
    label: "Dividend Aristocrats",
    tickers: [],
  },
  semiconductors: {
    label: "Semiconductors",
    tickers: ["NVDA","AVGO","TSM","ASML","AMD","QCOM","TXN","INTC","AMAT","LRCX","KLAC","MRVL","ON","MPWR","MCHP","NXPI","ADI","STM","GFS","MU","ENTG","MKSI","SNPS","CDNS","SMCI","VRT","SWKS","QRVO","CRUS","SLAB","SYNA","SITM","ALGM","DIOD","RMBS","SMTC","AMBA","WOLF","PI","FORM","ACMR","ACLS","ONTO","COHU","ICHR","UCTT","AEHR","CEVA","AMKR","AZTA","BRKS","KEYS","TER","NOVA","IFNNY","AMS","LSCC","AEIS","IPGP","IIVI","LITE","VIAV","FNSR","MACOM","MTSI","NVEC","IMOS","HIMX","CCMP","NEON","OLED","KLIC","RTEC","HLIT","KOPIN","EMKR","POWI","LFUS","BEL","SANM","PLXS","FLEX","CLS","JBL","APH","TEL","HUBB","ROG","CRS","WIRE","NVT","ATKR","GTLS","ALRM","DGII","CAMP","SIGM","PCTEL","SPNS","NICE","PERI","MTLS","DM","SSYS","DDD","NNDM","GFAI","KULR","MNTV","SVMK","SPSC","QTWO","APPF","YEXT","PLTK","NCNO","ENFN","ALKT","TOST","BLZE","INDI","OUST","LIDR","INVZ","LAZR","MVIS","VLDR","AEVA","SNAP","MTTR","MAPS","SPWR","MAXN","DAQO","JKS","CSIQ","ARRY","SHLS","SEDG","ENPH","FSLR","NEP","AY","CWEN","ORA","AMRC","BE","PLUG","FCEL","BLDP","HYZON","SLDP"],
  },
  cloud_computing: {
    label: "Cloud Computing",
    tickers: ["MSFT","AMZN","GOOGL","ORCL","CRM","NOW","SNOW","DDOG","NET","MDB","CFLT","ESTC","SUMO","DT","NEWR","PD","TEAM","MNDY","ASAN","HUBS","FRSH","BRZE","ZI","PCOR","APPN","ALTR","WDAY","INTU","ADSK","ANSS","SNPS","CDNS","PTC","AZPN","MANH","VEEV","SMAR","COUP","BILL","GTLB","FROG","DOMO","CDAY","PAYC","PCTY","ADP","PAYX","GWRE","APPF","YEXT","ALRM","BAND","TWLO","ZM","RNG","EGHT","FIVN","NICE","VRNT","SPLK","IBM","CTXS","PSTG","NTAP","NTNX","ZS","OKTA","CRWD","PANW","FTNT","VRNS","SAIL","CYBR","TENB","RPD","AKAM","FFIV","ANET","JNPR","CSCO","VMW","AVLR","SSNC","PRFT","EPAM","ACN","CTSH","WIT","INFY","GLOB","PEGA","BLKB","SPSC","QTWO","NCNO","ALKT","TOST","ENFN","CWAN","TASK","SVMK","MNTV","TTGT","ZETA","TTD","APP","DV","IAS","MGNI","PUBM","CRTO","PERI","ZG","OPEN","RDFN","CARG","CARS","CDK","WEX","LPSN","SNCR","BAND","CLDR","TLND","PRGS","AMSWA","BASE","CLBT","PATH","AI","PLTR","BBAI","SOUN","GFAI","RDDT","DUOL","CHGG","COUR","UDMY","K12","LAUR","2U","ATGE","PRDO","IDAI","CSOD","SAP","IONQ","QBTS","RGTI","ARQQ","YOU","TTEC","SAIC","CACI","BAH","LDOS","DOCS","HIMS","PGNY","ACCD","PHR","OMCL","TDOC","AMWL","OPRX","CLOV","NXGN","MDRX","HSTM","ONEM","SGFY","PRVA","HQY","CANO","OSH"],
  },
  defense: {
    label: "Defense",
    tickers: ["LMT","RTX","NOC","GD","BA","HII","LHX","TXT","HEI","TDG","SPR","AXON","KTOS","MOOG","DRS","LDOS","SAIC","BAH","CACI","MANT","AVAV","PLTR","BWXT","CW","HEICO","AIR","FLIR","NPK","DXC","KEYW","TTEC","PRFT","EPAM","MAXIMUS","ICFI","VSE","AMETEK","CPI","SAAB","BAESY","THALES","ORB","RKLB","ASTR","SPCE","LUNR","ASTS","MNTS","PL","BKSY","SPIR","SATL","POWW","VSTO","SWBI","RGR","AOBC","VRRM","SSTI","BBAI","TELOS","MNDT","IRNT","IDSY","DZSI","PCTEL","VIAVI","CIEN","CAMP","DGII","INPX","ALCO","AMMO","GEO","CXW","YOU","TTOO","SAFE","CEVA","CRSR","GHM","HAYN","CRS","KALU","ATI","HXL","ESLT","IAI","RHM","LDO","GRC","JKHY","GPN","WEX","FLT","CDAY","HURN","FCN","FORR","G","CNXC","EXLS","WNS","SNX","CDW","AMSC","POWL","ERII","ARGAN","PESI","ENS","BWEN","ESAB","FLOW","SPXC","ARLO","NTGR","SMTC"],
  },
  cannabis: {
    label: "Cannabis",
    tickers: [],
  },
} as const;

export const RADAR_SECTOR_KEYS = Object.keys(RADAR_SECTORS);
