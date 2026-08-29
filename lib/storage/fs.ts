import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { NotFoundError, VersionConflictError } from './errors';
import { fileVersion } from './version';
import type { CasWrite, StorageDriver } from './types';

export function boardsDir(): string {
  return process.env.KANBAN_DATA_DIR ?? join(process.cwd(), 'data');
}

function boardPath(name: string): string {
  return join(boardsDir(), `${name}.md`);
}

// 단일 프로세스 전제(dev·테스트)의 쓰기 직렬화 큐 — CAS 비교가 이 큐 안에서 원자적이 된다.
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const job = queue.catch(() => {}).then(fn);
  queue = job;
  return job;
}

async function readRawNow(name: string): Promise<string> {
  const p = boardPath(name);
  if (!existsSync(p)) throw new NotFoundError(`보드 없음: ${name}`);
  return readFile(p, 'utf-8');
}

export const fsDriver: StorageDriver = {
  async list() {
    const files = await readdir(boardsDir());
    return files
      .filter((f) => f.endsWith('.md') && f.toUpperCase() !== 'AGENTS.MD')
      .map((f) => f.slice(0, -3));
  },
  readRaw(name) {
    return readRawNow(name);
  },
  casWrite(w) {
    return enqueue(async () => {
      const current = await readRawNow(w.name);
      if (fileVersion(current) !== w.expectedVersion) throw new VersionConflictError('보드가 그새 바뀌었어요');
      await writeFile(boardPath(w.name), w.next, 'utf-8');
      return { version: w.nextVersion };
    });
  },
  casWritePair(dst, src) {
    return enqueue(async () => {
      // 검증을 먼저 끝낸 뒤 대상(dst)부터 쓴다 — 중간 실패 시 유실 대신 중복(복구 가능)
      const srcCur = await readRawNow(src.name);
      if (fileVersion(srcCur) !== src.expectedVersion) throw new VersionConflictError('보드가 그새 바뀌었어요');
      const dstCur = await readRawNow(dst.name);
      if (fileVersion(dstCur) !== dst.expectedVersion) throw new VersionConflictError('보드가 그새 바뀌었어요');
      await writeFile(boardPath(dst.name), dst.next, 'utf-8');
      await writeFile(boardPath(src.name), src.next, 'utf-8');
      return { version: src.nextVersion };
    });
  },
  create(name, content) {
    return enqueue(async () => {
      const p = boardPath(name);
      if (existsSync(p)) throw new Error(`이미 있는 보드: ${name}`);
      await writeFile(p, content, 'utf-8');
    });
  },
  trash(name) {
    return enqueue(async () => {
      const p = boardPath(name);
      if (!existsSync(p)) throw new NotFoundError(`보드 없음: ${name}`);
      const trash = join(boardsDir(), '.trash');
      await mkdir(trash, { recursive: true });
      await rename(p, join(trash, `${name}.md.${Date.now()}`));
    });
  },
};
