import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/table',
        destination: '/todos',
        permanent: false,
      },
    ]
  },
};

export default nextConfig;
