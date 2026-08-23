import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The PDF builder reads bundled fonts from disk at runtime; make sure
  // serverless output tracing ships them with the API routes.
  outputFileTracingIncludes: {
    "/api/projects/[id]/interior/build": ["./src/assets/fonts/**"],
  },
};

export default nextConfig;
