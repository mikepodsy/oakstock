"use client";

import { useState } from "react";

interface CompanyDescriptionProps {
  description: string | null;
}

export function CompanyDescription({ description }: CompanyDescriptionProps) {
  const [showFull, setShowFull] = useState(false);

  if (!description) return null;

  const truncated =
    description.length > 300 && !showFull
      ? description.slice(0, 300).replace(/\s+\S*$/, "") + "..."
      : description;

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
      <h3 className="text-sm font-medium text-text-primary mb-2">About</h3>
      <p className="text-xs text-text-secondary leading-relaxed">{truncated}</p>
      {description.length > 300 && (
        <button
          onClick={() => setShowFull(!showFull)}
          className="text-xs text-green-primary hover:underline mt-2"
        >
          {showFull ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
