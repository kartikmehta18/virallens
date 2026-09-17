import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/DB drivers stay as regular Node requires instead of being bundled.
  serverExternalPackages: ["mariadb", "ioredis", "@prisma/adapter-mariadb"],
};

export default nextConfig;
