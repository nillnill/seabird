export async function callClaude({ systemPrompt, userMessage, maxTokens = 1000 }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Claude API ${response.status}: ${err?.error?.message ?? 'unknown'}`);
  }

  const data = await response.json();
  const text = data.content[0].text;

  // 코드블록 제거 후 첫 { ~ 마지막 } 사이만 추출
  const stripped = text.replace(/```json\n?|```/g, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error(`No JSON object found: ${text.substring(0, 200)}`);
  const clean = stripped.slice(start, end + 1);

  try {
    return JSON.parse(clean);
  } catch {
    throw new Error(`JSON parse failed: ${text.substring(0, 300)}`);
  }
}
