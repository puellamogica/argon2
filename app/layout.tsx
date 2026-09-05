import type { Metadata } from "next";
import { M_PLUS_1, M_PLUS_1_Code } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { ThemeInit } from "./components/ThemeInit";
import { ThemeToggle } from "./components/ThemeToggle";
import "./globals.css";

const mplus1 = M_PLUS_1({
  variable: "--font-mplus1",
});

const mplus1code = M_PLUS_1_Code({
  variable: "--font-mplus1code",
});

export const metadata: Metadata = {
  title: "Argon2 Verify API",
  description: "Server-to-server API for Argon2 password verification",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="acid"
      className={`${mplus1.variable} ${mplus1code.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-base-100 text-base-content min-h-screen font-sans">
        <ThemeInit />
        <div className="navbar bg-base-200 shadow-sm">
          <div className="flex-1">
            <span className="btn btn-ghost text-xl normal-case">
              argon2 verify
            </span>
          </div>
          <div className="flex-none">
            <ThemeToggle />
          </div>
        </div>
        <main className="container mx-auto max-w-4xl px-4 py-8">
          {children}
        </main>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
