import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  serverExternalPackages: ["better-sqlite3", "onnxruntime-node"],
};

export default nextConfig;
