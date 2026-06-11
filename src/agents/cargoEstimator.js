const PROXY_URL = import.meta.env.VITE_PROXY_URL ?? 'http://localhost:3001';

export async function runCargoEstimator(mmsi, fallbackShip = null) {
  const res = await fetch(`${PROXY_URL}/api/cargo-estimate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mmsi, ship: fallbackShip }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `서버 오류 ${res.status}`);
  }
  return res.json();
}
