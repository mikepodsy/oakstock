import { Scale } from "lucide-react";

export default function RebalancePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-104px)] px-6 text-center">
      <Scale className="h-12 w-12 text-oak-300 mb-4 opacity-60" />
      <h1 className="font-display text-xl text-text-primary mb-2">
        AI Rebalancing
      </h1>
      <p className="text-text-secondary text-sm max-w-sm">
        Get intelligent portfolio rebalancing suggestions. Coming in Phase 4.
      </p>
    </div>
  );
}
