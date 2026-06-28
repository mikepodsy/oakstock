// Types for the Volatility Dashboard (/options/[ticker]/volatility).

// One day of the IV/HV history series (vols as fractions, 0.28 = 28%).
export interface VolHistoryPoint {
  date: string; // YYYY-MM-DD
  iv: number | null; // ~30-day implied vol
  hv: number | null; // realized/historical vol
  vrp: number | null; // iv - hv
}

// Section 1 + 4 stats, derived from the history series.
export interface VolStats {
  currentIv: number | null;
  currentHv: number | null;
  ivRank: number | null; // 0..1, current vs 52-week range
  ivPercentile: number | null; // 0..1, % of past 252 days below today
  currentVrp: number | null;
  avgVrp1y: number | null;
  vrpPercentile: number | null;
  avg30Iv: number | null;
  avg90Iv: number | null;
  yearHighIv: number | null;
  yearLowIv: number | null;
}

// Section 2: one expiry's ATM IV.
export interface TermStructurePoint {
  expiry: string; // YYYY-MM-DD
  dte: number; // days to expiry
  atmIv: number | null;
}

// Section 3: one strike's implied vol for the selected expiry.
export interface SkewPoint {
  strike: number;
  delta: number | null; // call delta (puts mapped to equivalent call delta)
  iv: number | null;
}

export interface SkewData {
  expiry: string;
  spot: number | null;
  points: SkewPoint[];
  atmIv: number | null;
  put25Iv: number | null; // 25-delta put IV
  call25Iv: number | null; // 25-delta call IV
  putSkew: number | null; // put25 - atm
  callSkew: number | null; // call25 - atm
  riskReversal: number | null; // put25 - call25
}

// Full payload from /api/options/volatility.
export interface VolatilityResponse {
  ticker: string;
  spot: number | null;
  asOf: string;
  history: VolHistoryPoint[];
  stats: VolStats;
  termStructure: TermStructurePoint[];
  skew: SkewData | null; // front-expiry skew (client can refetch other expiries)
  source: "dolthub" | "cache" | "none";
}
