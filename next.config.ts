import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Yerleşik node:sqlite kullanıldığı için derlenmesi gereken yerel paket yoktur.
  serverExternalPackages: ["exceljs"],
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
