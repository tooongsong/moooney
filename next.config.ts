import type { NextConfig } from "next";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  // Lets the dev server be reached from your phone over LAN (e.g. testing "Add to Home Screen" on iPhone).
  allowedDevOrigins: ['192.168.0.0/16', '10.0.0.0/8'],
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
};

export default withPWA(nextConfig);
