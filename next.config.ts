import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // fs reads in questionV3Store trace the required bank files automatically.
  // Turbopack includes match substrings and run after excludes, so forcing
  // the encrypted filename here would also re-add its .tmp siblings.
  outputFileTracingExcludes: {
    '/*': ['./cpa_uploader/data/cpa_question_sets_v3.authoring.json', './**/*.tmp'],
  },
};

export default nextConfig;
