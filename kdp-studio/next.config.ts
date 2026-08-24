import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The PDF builder reads bundled fonts from disk at runtime; make sure
  // serverless output tracing ships them with the API routes.
  outputFileTracingIncludes: {
    "/api/projects/[id]/interior/build": ["./src/assets/fonts/**"],
    "/api/projects/[id]/cover/build": ["./src/assets/fonts/**"],
    // The package builder can build both PDFs itself when none exist yet.
    "/api/projects/[id]/export/package": ["./src/assets/fonts/**"],
    // Colour-by-numbers pages draw region numbers as SVG text — serverless
    // ships no system fonts, so the generate route needs the bundled ones.
    "/api/pages/[pageId]/generate": ["./src/assets/fonts/**"],
  },
};

export default nextConfig;
