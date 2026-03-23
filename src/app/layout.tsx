import type { Metadata } from "next";
import localFont from "next/font/local";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { DataProvider } from "@/components/layout/DataProvider";
import { Sidebar } from "@/components/layout/Sidebar";
import { MarketOverviewBar } from "@/components/layout/MarketOverviewBar";
import { Toaster } from "@/components/ui/sonner";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const aspekta = localFont({
  src: "../../public/fonts/AspektaVF.woff2",
  variable: "--font-aspekta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Oakstock — Portfolio Intelligence",
  description:
    "Portfolio tracking and intelligence for self-directed investors. Rooted in growth.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark" suppressHydrationWarning>
        <body
          className={`${aspekta.variable} ${aspekta.className} antialiased`}
        >
          <ThemeProvider>
            <DataProvider>
              <div className="flex flex-col md:flex-row h-screen overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col overflow-hidden">
                  <MarketOverviewBar />
                  <main className="flex-1 overflow-y-auto">{children}</main>
                </div>
              </div>
              <Toaster />
              <SpeedInsights />
            </DataProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
