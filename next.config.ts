import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure docs/policies.md (read at runtime by app/api/chat) is included
  // in the serverless function bundle.
  outputFileTracingIncludes: {
    "/api/chat": ["./docs/**/*"],
  },
};

export default nextConfig;
