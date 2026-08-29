// 쓰기 성공 후 변경 신호만 발신 — 내용은 싣지 않는다(공개 Realtime 채널이라 내용이 새면 안 된다).
// env 미설정(fs 모드)·발신 실패는 no-op: 신호 유실은 다음 조작·재접속 재조회로 회복된다.
export type ChangeSignal = { kind: 'board'; board: string } | { kind: 'chat' };

export async function broadcastChange(payload: ChangeSignal): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url.replace(/\/$/, '')}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ topic: 'kanban', event: 'change', payload, private: false }] }),
      signal: AbortSignal.timeout(2000),
    });
  } catch {}
}
