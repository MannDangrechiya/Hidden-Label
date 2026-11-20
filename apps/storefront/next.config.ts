import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * GAP-INF-01: HSTS and a Content-Security-Policy. The policy has to keep Razorpay's hosted
 * checkout working (script + frame + connect), allow Next's inline bootstrap, and permit the
 * remote product photography. `unsafe-eval` is dev-only (hot reload); HSTS is production-only
 * so a local http://localhost origin is never pinned.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  [
    "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://api.razorpay.com",
    isDev ? "'unsafe-eval'" : "",
  ]
    .filter(Boolean)
    .join(" "),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  [
    "connect-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://lumberjack.razorpay.com",
    isDev ? "ws: wss:" : "",
  ]
    .filter(Boolean)
    .join(" "),
  "frame-src https://api.razorpay.com https://checkout.razorpay.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
]
  .join("; ")
  .concat(isDev ? "" : "; upgrade-insecure-requests");

/**
 * SEC: the image optimiser is an authenticated proxy, so it must not fetch arbitrary hosts.
 * The allowlist is derived from the origins this deployment actually uses:
 *   - the Medusa backend (or object storage) that serves uploaded product media;
 *   - the seeded editorial photography host;
 *   - any extra origins listed in NEXT_PUBLIC_IMAGE_HOSTS (comma separated).
 * A wildcard host is deliberately not permitted.
 */
function imageRemotePatterns(): Array<{
  protocol: "http" | "https";
  hostname: string;
  port?: string;
  pathname?: string;
}> {
  const patterns: Array<{
    protocol: "http" | "https";
    hostname: string;
    port?: string;
    pathname?: string;
  }> = [{ protocol: "https", hostname: "images.unsplash.com", pathname: "/**" }];

  const candidates = [
    process.env.NEXT_PUBLIC_MEDUSA_URL,
    process.env.MEDUSA_URL,
    process.env.S3_PUBLIC_BASE_URL,
    ...(process.env.NEXT_PUBLIC_IMAGE_HOSTS ?? "").split(","),
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (!value) continue;

    try {
      const url = new URL(value.includes("://") ? value : `https://${value}`);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      const protocol = url.protocol === "http:" ? "http" : "https";
      const duplicate = patterns.some(
        (pattern) =>
          pattern.protocol === protocol &&
          pattern.hostname === url.hostname &&
          (pattern.port ?? "") === (url.port ?? ""),
      );
      if (!duplicate) {
        patterns.push({
          protocol,
          hostname: url.hostname,
          ...(url.port ? { port: url.port } : {}),
          pathname: "/**",
        });
      }
    } catch {
      // A malformed origin is ignored rather than widening the allowlist.
    }
  }

  return patterns;
}

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; Next transpiles them rather than needing a
  // build step in each package.
  transpilePackages: ["@thl/shared", "@thl/ui"],
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: imageRemotePatterns(),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
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
