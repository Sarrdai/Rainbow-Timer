import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  output: 'export',
  trailingSlash: true,
  distDir: 'out',
  images: {
    unoptimized: true, // Required for static export
  },
};

export default nextConfig;
