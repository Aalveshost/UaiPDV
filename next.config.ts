import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['192.168.18.120', 'webhook.aalves.dev', 'localhost:3001'],
};

export default nextConfig;
