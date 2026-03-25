import("./env.mjs");

const securityHeaders = [
  // Empêche le MIME sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Protection clickjacking (complété par CSP frame-ancestors)
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Force HTTPS pendant 1 an (prod uniquement)
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Limite les infos de referrer aux cross-origin
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Désactive les fonctionnalités non utilisées
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // CSP : protection XSS
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js App Router requiert unsafe-inline pour l'hydratation
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline'",
      // Avatars Google + GitHub + placeholder
      "img-src 'self' data: blob: https://lh3.googleusercontent.com https://avatars.githubusercontent.com https://randomuser.me",
      // API calls + SSE
      "connect-src 'self' https://api.stripe.com",
      // Stripe hosted fields
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "font-src 'self'",
      // Bloque l'embedding de cette app dans des iframes externes
      "frame-ancestors 'self'",
    ].join("; "),
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  reactStrictMode: true,
  swcMinify: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "randomuser.me",
      },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client"],
    instrumentationHook: true,
  },
};

module.exports = nextConfig;
