import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 루트 repo의 package-lock.json 때문에 turbopack이 워크스페이스 루트를 repo 루트로
  // 오추론하면 본체 계산기의 postcss 설정을 집어들어 Vercel git 빌드가 깨진다(2026-08-28 실측).
  // npm run 계열은 항상 이 폴더를 cwd로 실행하므로 cwd 고정이 안전하다.
  turbopack: { root: process.cwd() },
};

export default nextConfig;
