import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static: no backend/API routes (LLM calls go device -> OpenRouter
  // directly per the build spec). Same "out" build is deployed to Vercel
  // and embedded into the Capacitor Android shell.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
