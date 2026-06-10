export async function callClaude({ systemPrompt, userMessage, maxTokens = 1000 }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
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
  const clean = text.replace(/```json\n?|```/g, '').trim();

  try {
    return JSON.parse(clean);
  } catch {
    throw new Error(`JSON parse failed: ${text.substring(0, 200)}`);
  }
}
