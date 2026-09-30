/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cytoscape keeps internal mutable state that doesn't survive React 18
  // StrictMode's dev-only double-invoke of effects (destroys/recreates the
  // cy instance mid-render and throws on stale event handlers).
  reactStrictMode: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/:path*`,
      },
      {
        source: "/agent/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/agent/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
