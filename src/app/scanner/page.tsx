"use client";

import { ScannerWorkspace } from "@/components/scanner/ScannerWorkspace";

// Deliberately not the usual `p-6 max-w-7xl mx-auto` page shell — the scanner
// fills the whole main area so the chart gets every available pixel.
export default function ScannerPage() {
  return (
    <div className="h-full min-h-0">
      <ScannerWorkspace />
    </div>
  );
}
