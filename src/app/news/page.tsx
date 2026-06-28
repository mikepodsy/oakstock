"use client";

import { NewsSection } from "@/components/news/NewsSection";

export default function NewsPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl text-text-primary">News</h1>
        <p className="text-sm text-text-secondary mt-1">
          Market headlines and news for your holdings and watchlist
        </p>
      </div>

      <NewsSection />
    </div>
  );
}
