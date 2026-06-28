"use client";

import { formatDistanceToNow, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { newsSourceBadgeClass, type NewsItem } from "@/types/news";

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

export function NewsCard({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl border border-border-primary bg-bg-secondary p-4 transition-all duration-150 hover:border-oak-300/40 hover:bg-bg-tertiary"
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            newsSourceBadgeClass(item.source)
          )}
        >
          {item.source}
        </span>
        <span className="text-xs text-text-tertiary">
          {relativeTime(item.publishedAt)}
        </span>
      </div>

      <h3 className="text-sm font-semibold text-text-primary line-clamp-2 group-hover:text-green-primary transition-colors">
        {item.title}
      </h3>

      {item.type === "stock" && item.symbols.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {item.symbols.slice(0, 6).map((symbol) => (
            <Badge key={symbol} variant="secondary" className="text-[10px]">
              {symbol}
            </Badge>
          ))}
        </div>
      )}

      {item.summary && (
        <p className="text-xs text-text-tertiary line-clamp-3 mt-1.5">
          {item.summary}
        </p>
      )}
    </a>
  );
}
