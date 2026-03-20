"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarType, CalendarEvent } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";

interface CalendarGridViewProps {
  type: CalendarType;
  data: CalendarEvent[];
  loading: boolean;
}

const DOT_COLORS: Record<CalendarType, string> = {
  earnings: "bg-green-primary",
  dividends: "bg-blue-500",
  economic: "bg-orange-500",
  ipo: "bg-purple-500",
};

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatMonthYear(year: number, month: number) {
  return new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function CalendarGridView({ type, data, loading }: CalendarGridViewProps) {
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const event of data) {
      const dateKey = event.date.split("T")[0];
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(event);
    }
    return map;
  }, [data]);

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const todayKey = formatDateKey(now.getFullYear(), now.getMonth(), now.getDate());

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setSelectedDay(null);
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setSelectedDay(null);
  }

  if (loading) {
    return <Skeleton className="h-96 rounded-xl" />;
  }

  const selectedEvents = selectedDay ? (eventsByDate[selectedDay] ?? []) : [];

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-secondary transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h3 className="text-text-primary font-medium">{formatMonthYear(currentYear, currentMonth)}</h3>
        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-secondary transition-colors">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS_OF_WEEK.map((day) => (
          <div key={day} className="text-center text-xs text-text-tertiary font-medium py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="h-20" />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateKey = formatDateKey(currentYear, currentMonth, day);
          const events = eventsByDate[dateKey] ?? [];
          const isToday = dateKey === todayKey;
          const isSelected = dateKey === selectedDay;
          const maxDots = 3;
          const extraCount = events.length - maxDots;

          return (
            <button
              key={day}
              onClick={() => setSelectedDay(isSelected ? null : dateKey)}
              className={`h-20 rounded-lg p-1.5 text-left transition-colors border ${
                isSelected
                  ? "border-green-primary bg-bg-elevated"
                  : isToday
                  ? "border-green-primary/50 bg-bg-tertiary"
                  : "border-transparent hover:bg-bg-tertiary"
              }`}
            >
              <span className={`text-xs font-medium ${isToday ? "text-green-primary" : "text-text-secondary"}`}>
                {day}
              </span>
              <div className="flex flex-wrap gap-0.5 mt-1">
                {events.slice(0, maxDots).map((_, j) => (
                  <span key={j} className={`w-1.5 h-1.5 rounded-full ${DOT_COLORS[type]}`} />
                ))}
                {extraCount > 0 && (
                  <span className="text-[10px] text-text-tertiary">+{extraCount}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected day detail panel */}
      {selectedDay && (
        <div className="mt-4 p-4 bg-bg-secondary rounded-xl border border-border-primary">
          <h4 className="text-sm font-medium text-text-primary mb-3">
            {new Date(selectedDay + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </h4>
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-text-tertiary">No events on this day</p>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map((event, i) => (
                <div key={i} className="flex items-center gap-3 text-sm py-1.5 border-b border-border-secondary last:border-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_COLORS[type]}`} />
                  <span className="text-text-primary">
                    {"symbol" in event ? event.symbol : ""}
                    {"event" in event ? event.event : ""}
                  </span>
                  <span className="text-text-tertiary ml-auto">
                    {"company" in event && event.company ? event.company : ""}
                    {"country" in event ? event.country : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
