import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    }];
  },
  // fs reads in questionV3Store trace the required bank files automatically.
  // Turbopack includes match substrings and run after excludes, so forcing
  // the encrypted filename here would also re-add its .tmp siblings.
  outputFileTracingExcludes: {
    '/*': ['./cpa_uploader/data/cpa_question_sets_v3.authoring.json', './**/*.tmp'],
  },
};

export default nextConfig;
