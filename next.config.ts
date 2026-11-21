import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Allow the dev server to be opened through GitHub Codespaces forwarded URLs.
  allowedDevOrigins: ["*.app.github.dev"],
};

export default nextConfig;
