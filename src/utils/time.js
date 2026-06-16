// Supabase 시간 컬럼은 `TIMESTAMP`(타임존 없음) + DEFAULT NOW() — UTC 벽시계 값이
// 오프셋/'Z' 없이 직렬화된다(예: "2026-06-16T00:34:07.123"). new Date()는 이런
// 무(無)존 문자열을 **브라우저 로컬**로 파싱하므로, 그대로 두면 toLocaleString의
// timeZone:'Asia/Seoul' 옵션을 줘도 이미 9시간 어긋난 인스턴트라 KST 변환이 무효가 된다.
// → 오프셋/'Z'가 없으면 UTC로 간주해 'Z'를 붙여 파싱한다.
export function parseUtc(ts) {
  if (ts == null) return new Date(NaN);
  if (ts instanceof Date) return ts;
  const s = String(ts);
  const hasZone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s);
  return new Date(hasZone ? s : s.replace(' ', 'T') + 'Z');
}

// DB 타임스탬프 → 한국 시간 문자열
export function fmtKst(ts, opts) {
  const d = parseUtc(ts);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', ...opts });
}

// DB 타임스탬프 → 한국 시간 "HH:MM"
export function fmtKstTime(ts) {
  const d = parseUtc(ts);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' });
}
