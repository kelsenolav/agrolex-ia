import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'pdfjs-dist',
    '@napi-rs/canvas',
    'pdf-parse',
    'pdf2json',
  ],
};

export default nextConfig;
