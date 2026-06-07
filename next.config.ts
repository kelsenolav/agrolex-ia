import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Externalizar pacotes pesados para evitar limite de 250 MB da Serverless Function
  serverExternalPackages: [
    'pdfjs-dist',
    '@napi-rs/canvas',
    'pdf-parse',
    'pdf2json',
  ],
  // Excluir workers/bins pesados do trace para reduzir tamanho zipado
  outputFileTracingExcludes: {
    '**/*': [
      '**/node_modules/pdfjs-dist/**/*.mjs',
      '**/node_modules/@napi-rs/canvas/**/*',
      '**/node_modules/pdf-parse/**/*',
      '**/node_modules/pdf2json/**/*',
    ],
  },
};

export default nextConfig;
