const PROXY_URL = import.meta.env.VITE_PROXY_URL ?? 'http://localhost:3001';

export async function routeCommand(userText, selectedShip = null) {
  const res = await fetch(`${PROXY_URL}/api/orchestrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: userText, selectedShip }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `서버 오류 ${res.status}`);
  }
  return res.json();
}
