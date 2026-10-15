/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  experimental: { serverComponentsExternalPackages: ["sharp", "mysql2", "bcryptjs"] },
};
export default nextConfig;
