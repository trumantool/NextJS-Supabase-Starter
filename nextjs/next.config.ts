import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/table',
        destination: '/todos',
        permanent: false,
      },
      {
        source: '/resume-builder',
        destination: '/documents',
        permanent: false,
      },
      {
        source: '/resume-builder/api/resumes',
        destination: '/documents/api/documents',
        permanent: false,
      },
      {
        source: '/resume-builder/api/resumes/:id',
        destination: '/documents/api/documents/:id',
        permanent: false,
      },
      {
        source: '/resume-builder/:path*',
        destination: '/documents/:path*',
        permanent: false,
      },
    ]
  },
};

export default nextConfig;
