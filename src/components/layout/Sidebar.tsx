"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Leaf,
  Menu,
  LayoutDashboard,
  Briefcase,
  Eye,
  Radar,
  CalendarDays,
  HandCoins,
  TrendingUp,
  Calculator,
  Scale,
  Globe,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
} from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { ThemeToggle } from "./ThemeToggle";
import { SearchBar } from "./SearchBar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";

const NAV_LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase },
  { href: "/watchlist", label: "Watchlist", icon: Eye },
  { href: "/radar", label: "Radar", icon: Radar },
  { href: "/market-data", label: "Market Data", icon: Globe },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/dividends", label: "Dividends", icon: HandCoins },
  { href: "/economic", label: "Economic", icon: TrendingUp },
  { href: "/dcf", label: "DCF", icon: Calculator },
  { href: "/rebalance", label: "Rebalance", icon: Scale },
  { href: "/experts", label: "Experts", icon: Users },
];

const STORAGE_KEY = "oakstock-sidebar-collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setCollapsed(true);
    setMounted(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    if (href === "/portfolio") return pathname === "/portfolio";
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col h-screen bg-bg-secondary border-r border-border-primary transition-all duration-200 shrink-0 ${
          collapsed ? "w-16" : "w-56"
        }`}
      >
        {/* Logo */}
        <div className={`flex items-center h-14 px-4 ${collapsed ? "justify-center" : "gap-2.5"}`}>
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <Leaf className="h-6 w-6 text-green-primary shrink-0" />
            {!collapsed && (
              <span className="font-display text-lg text-text-primary whitespace-nowrap">
                OAKSTOCK
              </span>
            )}
          </Link>
        </div>

        {/* Nav links */}
        <nav className="flex-1 flex flex-col gap-1 px-2 py-2 overflow-y-auto">
          {NAV_LINKS.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                title={collapsed ? link.label : undefined}
                className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-colors ${
                  collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
                } ${
                  active
                    ? "bg-green-muted text-green-primary"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
                }`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span>{link.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className={`flex flex-col gap-2 px-2 py-3 border-t border-border-primary ${collapsed ? "items-center" : ""}`}>
          {!collapsed && <SearchBar />}
          <div className={`flex items-center ${collapsed ? "flex-col gap-2" : "gap-2 px-1"}`}>
            <ThemeToggle />
            <UserButton />
            {!collapsed && <div className="flex-1" />}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleCollapsed}
              className="text-text-tertiary hover:text-text-primary"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar + sheet */}
      <div className="md:hidden shrink-0 z-50 h-14 bg-bg-secondary border-b border-border-primary flex items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <Leaf className="h-5 w-5 text-green-primary" />
          <span className="font-display text-lg text-text-primary">
            OAKSTOCK
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Sheet>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-text-secondary"
                />
              }
            >
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent
              side="left"
              className="bg-bg-secondary border-border-primary w-64 p-0"
            >
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-2.5 h-14 px-4 border-b border-border-primary">
                  <Leaf className="h-6 w-6 text-green-primary" />
                  <span className="font-display text-lg text-text-primary">
                    OAKSTOCK
                  </span>
                </div>
                <nav className="flex-1 flex flex-col gap-1 px-2 py-3">
                  {NAV_LINKS.map((link) => {
                    const Icon = link.icon;
                    const active = isActive(link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          active
                            ? "bg-green-muted text-green-primary"
                            : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
                        }`}
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0" />
                        <span>{link.label}</span>
                      </Link>
                    );
                  })}
                </nav>
                <div className="px-4 py-3 border-t border-border-primary">
                  <UserButton />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </>
  );
}
