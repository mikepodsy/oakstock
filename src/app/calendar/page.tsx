"use client";

import { useState, useMemo, useCallback } from "react";
import type { CalendarType } from "@/types";
import { useCalendar } from "@/hooks/useCalendar";
import { CalendarSidebar } from "@/components/calendar/CalendarSidebar";
import { CalendarHeader, type ViewMode, type DatePreset } from "@/components/calendar/CalendarHeader";
import { CalendarTableView } from "@/components/calendar/CalendarTableView";
import { CalendarGridView } from "@/components/calendar/CalendarGridView";

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function getDateRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  switch (preset) {
    case "this-week": {
      const dayOfWeek = now.getDay();
      const start = new Date(now);
      start.setDate(now.getDate() - dayOfWeek);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { from: formatDate(start), to: formatDate(end) };
    }
    case "this-month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: formatDate(start), to: formatDate(end) };
    }
    case "next-month": {
      const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      return { from: formatDate(start), to: formatDate(end) };
    }
  }
}

export default function CalendarPage() {
  const [calendarType, setCalendarType] = useState<CalendarType>("earnings");
  const [view, setView] = useState<ViewMode>("table");
  const [datePreset, setDatePreset] = useState<DatePreset>("this-month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const presetRange = useMemo(() => getDateRange(datePreset), [datePreset]);
  const from = customFrom || presetRange.from;
  const to = customTo || presetRange.to;

  const { data, loading, error } = useCalendar(calendarType, from, to);

  const handleDatePresetChange = useCallback((preset: DatePreset) => {
    setDatePreset(preset);
    setCustomFrom("");
    setCustomTo("");
  }, []);

  const counts = useMemo(() => ({
    earnings: calendarType === "earnings" ? data.length : 0,
    dividends: calendarType === "dividends" ? data.length : 0,
    economic: calendarType === "economic" ? data.length : 0,
    ipo: calendarType === "ipo" ? data.length : 0,
  }), [calendarType, data.length]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl text-text-primary">Calendar</h1>
        <p className="text-sm text-text-secondary mt-1">
          Track earnings, dividends, economic events, and IPOs
        </p>
      </div>

      {/* Mobile sidebar (horizontal tabs) */}
      <div className="md:hidden">
        <CalendarSidebar selected={calendarType} onSelect={setCalendarType} counts={counts} />
      </div>

      <div className="flex gap-6">
        {/* Desktop sidebar */}
        <CalendarSidebar selected={calendarType} onSelect={setCalendarType} counts={counts} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <CalendarHeader
            view={view}
            onViewChange={setView}
            datePreset={datePreset}
            onDatePresetChange={handleDatePresetChange}
            from={from}
            to={to}
            onFromChange={setCustomFrom}
            onToChange={setCustomTo}
          />

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-muted text-red-primary text-sm">
              {error}
            </div>
          )}

          {view === "table" ? (
            <CalendarTableView type={calendarType} data={data} loading={loading} />
          ) : (
            <CalendarGridView type={calendarType} data={data} loading={loading} />
          )}
        </div>
      </div>
    </div>
  );
}
