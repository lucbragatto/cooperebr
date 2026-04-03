import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ["**/node_modules/**", "**/backend/**", "**/whatsapp-service/**", "**/.claude/**", "**/.git/**"],
    };
    return config;
  },
};

export default nextConfig;
