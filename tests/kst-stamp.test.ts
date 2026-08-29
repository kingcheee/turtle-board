import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readBoard, applyBoardOp } from '../lib/store';

// localStamp()는 lib/store.ts 안의 비공개 함수라 직접 import할 수 없다 — store.test.ts는 동결이라
// 손댈 수 없으므로, applyBoardOp가 남기는 ⊕ 생성 타임스탬프(meta.createdAt)로 공개 API를 통해
// 행동을 검증한다. 기대값은 별도 공식(Date.now()+9h를 UTC로 찍기)으로 독립 계산한다 — KST는
// DST가 없는 UTC+9라 이 계산이 항상 정확하다. process.env.TZ 값과 무관해야 하는 게 이 수정의
// 핵심이므로, 로컬 Date 게터(getHours 등)는 기대값 계산에도 쓰지 않는다.
function expectedKstStamp(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');
}

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kanban-'));
  process.env.KANBAN_DATA_DIR = dir;
  copyFileSync(join(__dirname, 'fixtures', 'basic.md'), join(dir, '테스트 보드.md'));
});

afterEach(() => {
  delete process.env.KANBAN_DATA_DIR;
  rmSync(dir, { recursive: true, force: true });
});

describe('KST 타임스탬프 (localStamp, 프로세스 TZ 무관)', () => {
  it('add 연산의 createdAt이 독립 계산한 KST(UTC+9) 분 단위와 일치한다', async () => {
    const { version } = await readBoard('테스트 보드');
    await applyBoardOp('테스트 보드', { type: 'add', column: 0, title: 'KST 확인' }, version);
    const b = await readBoard('테스트 보드');
    const added = b.columns[0].cards[b.columns[0].cards.length - 1];
    const got = added.meta.createdAt;

    expect(got).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    if (got !== expectedKstStamp()) {
      // 분 경계를 넘나든 드문 레이스 — 한 번만 재계산 후 확정 판정
      expect(got).toBe(expectedKstStamp());
    }
  });
});
