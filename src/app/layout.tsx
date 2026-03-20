import type { Metadata } from "next";
import localFont from "next/font/local";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { DataProvider } from "@/components/layout/DataProvider";
import { Navbar } from "@/components/layout/Navbar";
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
