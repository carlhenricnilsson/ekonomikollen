import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Generera unikt build-ID varje gång för att undvika CDN-cache-problem
  generateBuildId: () => `build-${Date.now()}`,
  // Capability-URL:er (/results/<surveyId>) får inte läcka surveyId till
  // tredjepart via Referer. strict-origin-when-cross-origin skickar bara
  // origin (ej sökväg/UUID) vid cross-origin – icke-brytande; samma-origin
  // och integrationer (Stripe/analytics) får fortfarande origin.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
