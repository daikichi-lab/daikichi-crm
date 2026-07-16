/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // PGlite (dev/test driver) is a Node/WASM module; keep it external so it isn't bundled.
  serverExternalPackages: ['@electric-sql/pglite'],
  eslint: {
    // Lint is run explicitly via `npm run lint`; don't fail production builds on lint.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
