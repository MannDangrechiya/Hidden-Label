import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/** GAP-INF-01: the admin console gets the same hardening, with no third-party script origins. */
const contentSecurityPolicy = [
  "default-src 'self'",
  ["script-src 'self' 'unsafe-inline'", isDev ? "'unsafe-eval'" : ""].filter(Boolean).join(" "),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  ["connect-src 'self'", isDev ? "ws: wss:" : ""].filter(Boolean).join(" "),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
]
  .join("; ")
  .concat(isDev ? "" : "; upgrade-insecure-requests");

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; Next transpiles them rather than needing a
  // build step in each package.
  transpilePackages: ["@thl/shared", "@thl/ui"],
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          ...(isDev
            ? []
            : [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]),
        ],
      },
    ];
  },
};

export default nextConfig;
