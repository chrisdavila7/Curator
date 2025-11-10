import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure Node.js runtime for server routes that use native Node modules
  // We also explicitly set runtime = "nodejs" inside the route handler.
  serverExternalPackages: ["@azure/msal-node", "jose", "lru-cache"],
};

export default nextConfig;
