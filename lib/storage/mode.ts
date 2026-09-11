import { hasSupabaseEnv } from './supabase';

export type StorageMode = 'supabase' | 'fs';

// 저장 모드는 env로 정해진다. Vercel에서 env 누락 시 fs로 조용히 폴백하면 쓰기가 증발한다 — 명시적으로 죽인다.
export function storageMode(): StorageMode {
  if (hasSupabaseEnv()) return 'supabase';
  if (process.env.VERCEL) throw new Error('Supabase 환경변수 누락 — Vercel에서 fs 폴백 금지');
  return 'fs';
}
