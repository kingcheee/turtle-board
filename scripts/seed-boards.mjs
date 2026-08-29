// data/*.md → Supabase kanban_boards 업서트 (마이그레이션 시드 — 실행 시점 파일이 곧 초기 상태)
// 사용: npm run seed   (env는 셸 또는 kanban-board/.env.local에서 읽는다 — 셸이 우선)
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const envFile = join(root, '.env.local');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf-8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim();
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 필요합니다 (.env.local 또는 셸 env)');
  process.exit(1);
}

const dataDir = join(root, 'data');
const files = readdirSync(dataDir)
  .filter((f) => f.endsWith('.md') && f.toUpperCase() !== 'AGENTS.MD' && !f.startsWith('.'));

for (const f of files) {
  const name = f.slice(0, -3);
  const content = readFileSync(join(dataDir, f), 'utf-8');
  const version = createHash('sha256').update(content).digest('hex').slice(0, 12);
  const res = await fetch(`${url}/rest/v1/kanban_boards`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({ name, content, version, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) {
    console.error(`실패: ${name} — HTTP ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  console.log(`업서트: ${name} (${version})`);
}
console.log(`완료 — ${files.length}개 보드`);
