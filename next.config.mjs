/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Capacitor packages the exported web assets; keeping the app free of
  // server-only rendering assumptions in client routes keeps that path open.
  // (We keep SSR for now via the Next server on Vercel; a static export
  // profile for Capacitor is documented in README and added in Phase 5.)
  images: {
    // Avoid the Next image optimizer for Capacitor/static compatibility later.
    unoptimized: true,
  },
  eslint: {
    // Lint is run explicitly in CI via `npm run lint`.
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
