import type { NextConfig } from "next";

/** NestJS backend yo'nalishlari (Next.js /api/sync va /api/ai dan alohida) */
const NEST_API_SEGMENTS = [
  "auth",
  "properties",
  "tenants",
  "contracts",
  "payments",
  "expenses",
  "maintenance",
  "notifications",
  "users",
  "dashboard",
  "reports",
  "settings",
  "uploads",
  "docs",
] as const;

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  async rewrites() {
    const backend = process.env.BACKEND_URL?.replace(/\/$/, "");
    if (!backend) return [];

    const rules: { source: string; destination: string }[] = [
      {
        source: "/api/health",
        destination: `${backend}/health`,
      },
    ];

    for (const segment of NEST_API_SEGMENTS) {
      rules.push(
        {
          source: `/api/${segment}`,
          destination: `${backend}/api/${segment}`,
        },
        {
          source: `/api/${segment}/:path*`,
          destination: `${backend}/api/${segment}/:path*`,
        }
      );
    }

    rules.push(
      {
        source: "/uploads/:path*",
        destination: `${backend}/uploads/:path*`,
      },
      {
        source: "/health",
        destination: `${backend}/health`,
      }
    );

    return rules;
  },
};

export default nextConfig;
