import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // API routes read data/*.json at runtime via process.cwd(), which file tracing can't detect.
  outputFileTracingIncludes: {
    "/api/*": ["./data/**/*"],
  },
  // Block clickjacking: no other site may embed SimRoutes in a frame.
  headers: () => [
    {
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
      ],
    },
  ],
};

export default nextConfig;
