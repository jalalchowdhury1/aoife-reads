import type { NextConfig } from "next";
import { createRequire } from "node:module";

// next.config.ts runs outside the app's own module graph, so pull the version
// straight from package.json via createRequire rather than a bundler import.
const require = createRequire(import.meta.url);
const pkg = require("./package.json") as { version: string };

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
};

export default nextConfig;
