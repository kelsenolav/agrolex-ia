import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Externalizar pacotes pesados para evitar limite de 250 MB da Serverless Function
  serverExternalPackages: [
    'pdfjs-dist',
    '@napi-rs/canvas',
    'pdf-parse',
    'pdf2json',
  ],
};

export default nextConfig;
