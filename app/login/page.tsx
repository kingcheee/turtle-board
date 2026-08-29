'use client';

import { useState } from 'react';

export default function Login() {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    if (r.ok) location.href = '/';
    else setErr(true);
  }

  return (
    <div className="login">
      <form onSubmit={submit}>
        <h1 className="pixel" style={{ fontSize: 14 }}>거북이 보드</h1>
        <input type="password" placeholder="팀 비밀번호" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        {err && <p className="hint" style={{ color: '#c0392b' }}>비밀번호가 틀려요</p>}
        <button className="primary" type="submit">입장</button>
      </form>
    </div>
  );
}
