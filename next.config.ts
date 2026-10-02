import type {NextConfig} from 'next';

// Set by the GitHub Pages workflow (e.g. '/Rainbow-Timer'); empty for custom domains and native builds
const basePath = process.env.PAGES_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  trailingSlash: true,
  distDir: 'out',
  images: {
    unoptimized: true, // Required for static export
  },
};

export default nextConfig;
