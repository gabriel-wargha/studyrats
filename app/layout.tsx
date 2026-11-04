import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import { Suspense } from "react";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { TabBar } from "@/components/tab-bar";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
});

const body = Instrument_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "StudyRats", template: "%s | StudyRats" },
  description:
    "Log study sessions, earn a point for every minute, and climb your group's leaderboard.",
  applicationName: "StudyRats",
  appleWebApp: { capable: true, title: "StudyRats", statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f5f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0c1426" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
          <div className="flex flex-1 flex-col">{children}</div>
          {/* usePathname is request-time data on dynamic routes like /join/[code]. */}
          <Suspense fallback={null}>
            <TabBar />
          </Suspense>
        </div>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
