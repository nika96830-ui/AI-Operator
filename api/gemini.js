const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!process.env.GEMINI_API_KEY) {
    return json(res, 503, { error: 'Gemini is not configured. Add GEMINI_API_KEY to the Vercel project environment variables.' });
  }

  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  if (!prompt) return json(res, 400, { error: 'A non-empty prompt is required.' });
  if (prompt.length > 4000) return json(res, 413, { error: 'Prompt is too long. Limit it to 4000 characters.' });

  const instruction = `You are the planning engine for AI Operator, a read-first operations console. Analyze the user's task and return ONLY valid JSON with this exact shape: {"summary":"string","steps":[{"title":"string","detail":"string"}]}.
Rules: return 3 to 5 concrete, sequential steps; be honest about unavailable integrations; do not claim that you searched, changed, deployed, or verified anything; describe intended checks in future or planning language. User task: ${prompt}`;

  try {
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: instruction }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
    });
    const payload = await upstream.json();
    if (!upstream.ok) {
      console.error('Gemini API error', upstream.status, payload?.error?.message || 'unknown');
      return json(res, 502, { error: 'Gemini request failed. Check the server-side API key and model configuration.' });
    }

    const text = payload?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
    if (!text) return json(res, 502, { error: 'Gemini returned an empty response.' });
    let result;
    try { result = JSON.parse(text.replace(/^```json\s*|\s*```$/g, '')); } catch { return json(res, 502, { error: 'Gemini returned an invalid structured plan.' }); }
    if (!result || typeof result.summary !== 'string' || !Array.isArray(result.steps) || result.steps.length < 1) {
      return json(res, 502, { error: 'Gemini returned an incomplete plan.' });
    }
    const steps = result.steps.slice(0, 5).map(step => ({ title: String(step.title || 'Review task'), detail: String(step.detail || 'Prepare a safe read-first check.') }));
    return json(res, 200, { provider: 'Gemini API', model: MODEL, summary: result.summary, steps });
  } catch (error) {
    console.error('Gemini route error', error);
    return json(res, 500, { error: 'Unexpected server error while contacting Gemini.' });
  }
}
