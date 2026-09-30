/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return [];
    return [
      { source: "/api/:path*", destination: `${apiUrl}/api/:path*` },
      { source: "/agent/:path*", destination: `${apiUrl}/agent/:path*` },
    ];
  },
};

module.exports = nextConfig;
