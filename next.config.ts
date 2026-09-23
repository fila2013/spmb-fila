import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/api/admin/peserta/*/enrollment-pdf": [
      "node_modules/@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff",
      "node_modules/@fontsource/noto-sans/files/noto-sans-latin-600-normal.woff",
      "node_modules/@fontsource/noto-sans/files/noto-sans-latin-700-normal.woff",
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
