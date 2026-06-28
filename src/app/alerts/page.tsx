"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MomentumTable } from "@/components/alerts/MomentumTable";
import { useMomentumAlerts } from "@/hooks/useMomentumAlerts";

export default function AlertsPage() {
  const { statuses, loading, error, refetch } = useMomentumAlerts();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-text-primary">Alerts</h1>
          <p className="text-sm text-text-secondary mt-1">
            Mag 7 momentum vs the 50-day and 200-day moving averages (daily). Fresh
            same-session crosses are highlighted.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={refetch}
          disabled={loading}
          title="Refresh"
          className="text-text-tertiary hover:text-text-primary"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-primary bg-red-muted px-4 py-3 text-sm text-red-primary">
          {error}
        </div>
      )}

      {loading && statuses.length === 0 ? (
        <div className="text-sm text-text-secondary">Loading momentum…</div>
      ) : statuses.length === 0 && !error ? (
        <div className="text-sm text-text-secondary">No data available.</div>
      ) : (
        <MomentumTable statuses={statuses} />
      )}
    </div>
  );
}
