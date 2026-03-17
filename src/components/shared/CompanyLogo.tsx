"use client";

import { useState } from "react";

const LOGO_COLORS = [
  "#6366f1", "#8b5cf6", "#d946ef", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
];

function getLogoColor(ticker: string): string {
  const hash = ticker.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return LOGO_COLORS[hash % LOGO_COLORS.length];
}

export function CompanyLogo({
  ticker,
  website,
}: {
  ticker: string;
  website?: string;
}) {
  const [imgError, setImgError] = useState(false);
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
  const domain = website
    ? website.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]
    : null;
  const logoUrl =
    token && domain ? `https://img.logo.dev/${domain}?token=${token}&size=128` : null;

  if (!logoUrl || imgError) {
    return (
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0"
        style={{ backgroundColor: getLogoColor(ticker) }}
      >
        {ticker.slice(0, 2)}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={`${ticker} logo`}
      className="w-14 h-14 rounded-xl object-contain bg-white shrink-0"
      onError={() => setImgError(true)}
    />
  );
}
