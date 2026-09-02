import type { MetadataRoute } from "next";

// Required for metadata routes under `output: "export"` - the manifest is
// written out as a static file at build time rather than served.
export const dynamic = "force-static";

// Installing to the home screen is what actually removes the browser
// chrome and lets the app own the full screen; theme_color is what stops
// Android's status and navigation bars defaulting to white.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "All for One",
    short_name: "All for One",
    description:
      "The app that gets you the job, then keeps the life you built around it.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0c11",
    theme_color: "#0a0c11",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
