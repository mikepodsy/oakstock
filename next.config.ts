import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. Without this, Turbopack infers the
  // root from the nearest lockfile and can select the parent directory (which
  // contains an unrelated package-lock.json), breaking route resolution.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
