import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // API routes read data/*.json at runtime via process.cwd(), which file tracing can't detect.
  outputFileTracingIncludes: {
    "/api/*": ["./data/**/*"],
  },
};

export default nextConfig;
