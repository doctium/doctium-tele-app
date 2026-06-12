/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
  transpilePackages: ['@doctium/brand', '@doctium/types', '@doctium/validation'],
  // v15: experimental features available in stable
  serverExternalPackages: [],
};
export default nextConfig;
