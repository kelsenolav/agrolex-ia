import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'pdfjs-dist',
    '@napi-rs/canvas',
    'pdf-parse',
    'pdf2json',
  ],
  outputFileTracingExcludes: {
    '/api/analyze': [
      './node_modules/pdfjs-dist/**',
      './node_modules/@napi-rs/canvas/**',
      './node_modules/pdf-parse/**',
      './node_modules/pdf2json/**',
    ],
  },
};

export default nextConfig;
