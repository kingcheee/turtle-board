import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listMessages, appendMessage, _resetTeamChat } from '../lib/team-chat';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'team-chat-'));
  process.env.KANBAN_DATA_DIR = dir;
  _resetTeamChat();
});

afterEach(() => {
  delete process.env.KANBAN_DATA_DIR;
  rmSync(dir, { recursive: true, force: true });
});

describe('team-chat', () => {
  it('빈 상태에서 listMessages는 []', async () => {
    expect(await listMessages()).toEqual([]);
  });

  it('appendMessage: 저장되고 목록에 나온다', async () => {
    const m = await appendMessage('김지우', '안녕하세요');
    expect(m.sender).toBe('김지우');
    expect(m.text).toBe('안녕하세요');
    expect(m.id).toBeTruthy();
    expect(m.ts).toBeTruthy();
    expect(await listMessages()).toEqual([m]);
  });

  it('파일은 .team-chat.json — 보드 목록(.md)과 안 섞인다', async () => {
    await appendMessage('김기백', 'ㅎㅇ');
    expect(existsSync(join(dir, '.team-chat.json'))).toBe(true);
    const saved = JSON.parse(readFileSync(join(dir, '.team-chat.json'), 'utf-8'));
    expect(saved).toHaveLength(1);
  });

  it('명단에 없는 sender는 거부', async () => {
    await expect(appendMessage('외부인', 'ㅎ')).rejects.toBeInstanceOf(RangeError);
  });

  it('빈 텍스트·공백만은 거부, 앞뒤 공백은 잘린다', async () => {
    await expect(appendMessage('김지우', '   ')).rejects.toBeInstanceOf(RangeError);
    const m = await appendMessage('김지우', '  본문  ');
    expect(m.text).toBe('본문');
  });

  it('너무 긴 텍스트는 거부(2000자 초과)', async () => {
    await expect(appendMessage('김지우', 'a'.repeat(2001))).rejects.toBeInstanceOf(RangeError);
  });

  it('동시 전송해도 둘 다 저장된다(쓰기 직렬화)', async () => {
    await Promise.all([appendMessage('김지우', '동시1'), appendMessage('이원준', '동시2')]);
    const msgs = await listMessages();
    expect(msgs.map((m) => m.text).sort()).toEqual(['동시1', '동시2']);
  });

  it('500개 초과 시 오래된 것부터 버린다', async () => {
    for (let i = 0; i < 502; i++) await appendMessage('정지명', `m${i}`);
    const msgs = await listMessages();
    expect(msgs).toHaveLength(500);
    expect(msgs[0].text).toBe('m2');
    expect(msgs[499].text).toBe('m501');
  });
});
