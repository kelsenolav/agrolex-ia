import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Zwipe is an independent app inside the agrolex-ia repo, which has its own
  // lockfile at the repo root. Pin the Turbopack root here so it doesn't try
  // to resolve modules across both projects.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;

