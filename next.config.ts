import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Generera unikt build-ID varje gång för att undvika CDN-cache-problem
  generateBuildId: () => `build-${Date.now()}`,
};

export default nextConfig;
