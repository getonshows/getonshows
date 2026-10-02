/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Profile photo uploads go through server actions (5 MB cap in uploadPhoto).
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "tqrjlqxdrblbcqppkecb.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};
export default nextConfig;
