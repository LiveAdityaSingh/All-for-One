import Link from "next/link";
import type { ComponentProps } from "react";

// Every link in the app goes through here so prefetch stays off by
// default. This app is a static export served either from Vercel's CDN
// or from local files inside the Android WebView, so prefetching buys
// no meaningful latency - and the export writes its RSC payloads to
// paths that don't match what prefetch requests, so leaving it on just
// produces a failed request per link on every screen.
export function AppLink(props: ComponentProps<typeof Link>) {
  return <Link prefetch={false} {...props} />;
}
