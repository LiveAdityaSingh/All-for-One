import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppBootstrap } from "@/components/app-bootstrap";
import { TabBar } from "@/components/tab-bar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "All for One",
  description: "The app that gets you the job, then keeps the life you built around it.",
  // Lets iOS run it without Safari's chrome once added to the home screen.
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "All for One" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Without this Android paints its status and navigation bars white,
  // which reads as a border around a dark-first app.
  themeColor: "#0a0c11",
  colorScheme: "dark",
  // Lets the page draw underneath the system bars; the safe-area padding
  // in globals.css keeps content clear of them.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* dvh, not vh: on mobile browsers vh ignores the collapsing address
          bar and leaves the tab bar sitting under it. */}
      <body className="min-h-[100dvh]">
        {/* The room's lighting: one soft source at the top, behind everything. */}
        <div className="ambient-light" aria-hidden />
        <AppBootstrap />
        <main className="pb-tab-bar pt-6">{children}</main>
        <TabBar />
      </body>
    </html>
  );
}
