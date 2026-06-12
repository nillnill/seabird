const fetch = require('node-fetch');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// Claude 응답에서 JSON 추출 — 객체({})·배열([]) 모두 지원, 코드펜스·후행콤마 제거.
function extractJson(text) {
  const s = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const firstObj = s.indexOf('{');
  const firstArr = s.indexOf('[');
  let start, close;
  if (firstArr !== -1 && (firstObj === -1 || firstArr < firstObj)) { start = firstArr; close = ']'; }
  else { start = firstObj; close = '}'; }
  if (start === -1) throw new Error('No JSON in Claude response: ' + text.substring(0, 200));
  const end = s.lastIndexOf(close);
  if (end === -1 || end < start) throw new Error('Unterminated JSON in Claude response: ' + text.substring(0, 200));
  const json = s.slice(start, end + 1).replace(/,\s*([}\]])/g, '$1'); // 후행 콤마 제거
  try {
    return JSON.parse(json);
  } catch (e) {
    // 마지막 보정: 배열/객체 요소 사이 누락 콤마(Claude가 종종 빠뜨림). 실패한 JSON에만 적용.
    const repaired = json.replace(/}\s*{/g, '},{').replace(/]\s*\[/g, '],[');
    return JSON.parse(repaired); // 그래도 실패하면 throw → callClaude가 재시도
  }
}

async function callClaude({ systemPrompt, userMessage, maxTokens = 1000, model = 'claude-sonnet-4-6', rawText = false }) {
  let lastErr;
  // 일시적 오류·JSON 파싱 실패 시 1회 재시도 (Claude 응답 비결정성 대응)
  for (let attempt = 0; attempt < 2; attempt++) {
    let res;
    try {
      res = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        }),
      });
    } catch (e) { lastErr = e; continue; } // 네트워크 오류 → 재시도

    if (!res.ok) {
      const errText = await res.text();
      // 429/5xx는 재시도, 그 외(400 등)는 즉시 실패
      if (res.status === 429 || res.status >= 500) { lastErr = new Error(`Claude API ${res.status}`); continue; }
      throw new Error(`Claude API ${res.status}: ${errText.substring(0, 300)}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text ?? '';
    if (rawText) return text;

    try { return extractJson(text); }
    catch (e) { lastErr = e; } // 파싱 실패 → 재시도
  }
  throw lastErr;
}

module.exports = { callClaude };
