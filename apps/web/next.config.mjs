/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@dokane/ui', '@dokane/contracts'],
};

export default nextConfig;
