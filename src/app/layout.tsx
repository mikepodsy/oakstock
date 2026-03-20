import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { DataProvider } from "@/components/layout/DataProvider";
import { Navbar } from "@/components/layout/Navbar";
import { MarketOverviewBar } from "@/components/layout/MarketOverviewBar";
import { Toaster } from "@/components/ui/sonner";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
          className={`${instrumentSans.variable} ${jetbrainsMono.variable} antialiased`}
        >
          <ThemeProvider>
            <DataProvider>
              <Navbar />
              <MarketOverviewBar />
              <main className="min-h-[calc(100vh-104px)]">{children}</main>
              <Toaster />
              <SpeedInsights />
            </DataProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
