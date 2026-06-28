"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Builder ↔ Volatility tab switcher shown on both options pages so the
// volatility dashboard (IV/VRP, term structure, skew) is always one click away.
export function OptionsTabs({ ticker }: { ticker: string }) {
  const pathname = usePathname();
  const onVolatility = pathname?.endsWith("/volatility");

  const tabs = [
    { href: `/options/${ticker}`, label: "Builder", active: !onVolatility },
    { href: `/options/${ticker}/volatility`, label: "Volatility", active: !!onVolatility },
  ];

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border-primary p-0.5">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            t.active
              ? "bg-bg-tertiary text-text-primary"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
