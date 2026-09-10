import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "@react-pdf/renderer"],
};

export default nextConfig;
