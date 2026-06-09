import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",      // 정적 HTML 파일로 추출하겠다는 설정
  basePath: "/Study-Mate",
  assetPrefix: "/Study-Mate/",
  images: {
    unoptimized: true,   // 깃허브 페이지에서는 이미지 최적화 서버를 못 쓰므로 필수
  },
};

export default nextConfig;
