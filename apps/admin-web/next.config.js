/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@saas/types', '@saas/validation'],
  ...(process.env.NEXT_EXPORT === 'true' ? { output: 'export' } : {}),
  images: {
    unoptimized: process.env.NEXT_EXPORT === 'true',
    domains: ['images.unsplash.com', 'via.placeholder.com'],
  },
};

module.exports = nextConfig;
