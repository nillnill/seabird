const fetch = require('node-fetch');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

async function callClaude({ systemPrompt, userMessage, maxTokens = 1000, model = 'claude-sonnet-4-6', rawText = false }) {
  const res = await fetch(ANTHROPIC_API_URL, {
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

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API ${res.status}: ${errText.substring(0, 300)}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? '';

  if (rawText) return text;

  const stripped = text.replace(/```json\n?|```/g, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON in Claude response: ' + text.substring(0, 200));
  return JSON.parse(stripped.slice(start, end + 1));
}

module.exports = { callClaude };
