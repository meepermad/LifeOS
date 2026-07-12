import type { NextConfig } from "next";
import path from "path";
import { SECURITY_HEADERS } from "./src/lib/security/headers";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  poweredByHeader: false,
  headers: async () => [
    {
      source: "/:path*",
      headers: [...SECURITY_HEADERS],
    },
    {
      source: "/sw.js",
      headers: [
        ...SECURITY_HEADERS,
        {
          key: "Cache-Control",
          value: "no-cache, no-store, must-revalidate",
        },
        {
          key: "Service-Worker-Allowed",
          value: "/",
        },
      ],
    },
  ],
};

export default nextConfig;
