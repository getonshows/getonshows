/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Profile photo uploads go through server actions (5 MB cap in uploadPhoto).
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
};
export default nextConfig;
