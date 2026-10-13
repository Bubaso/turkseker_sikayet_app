import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "exceljs"],
  experimental: {
    serverActions: { bodySizeLimit: "25mb" },
  },
  // Türkşeker kurumsal sitesine <iframe> ile gömülecekse buradan izin verilir.
  async headers() {
    return [
      {
        source: "/sikayet/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
    ];
  },
};

export default nextConfig;
