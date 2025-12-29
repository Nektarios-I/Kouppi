/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { typedRoutes: true },
  // Do not fail production builds due to ESLint config issues.
  eslint: { ignoreDuringBuilds: true },
};

module.exports = nextConfig;