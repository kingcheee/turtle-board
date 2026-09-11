import { defineConfig } from 'vitest/config';

export default defineConfig({
  // '@/…' 별칭(tsconfig paths와 동일) — 라우트 핸들러 테스트가 app/api/*를 불러올 수 있게
  resolve: { alias: { '@': process.cwd() } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
