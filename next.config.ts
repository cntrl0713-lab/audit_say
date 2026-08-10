import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/*': ['./data/cpa_question_sets_v3.authoring.enc.json'],
  },
  outputFileTracingExcludes: {
    '/*': ['./cpa_uploader/data/cpa_question_sets_v3.authoring.json'],
  },
};

export default nextConfig;
