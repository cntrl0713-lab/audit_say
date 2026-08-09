import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/*': ['./data/cpa_question_sets_v3.authoring.enc.json'],
  },
};

export default nextConfig;
