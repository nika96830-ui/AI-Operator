const isTextModel = model => model && !/(tts|audio|image|embedding|veo)/i.test(model);
const requestedModel = process.env.GEMINI_MODEL?.trim();
const CONFIGURED_MODEL = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'].includes(requestedModel) ? requestedModel : 'gemini-flash-latest';
const FALLBACK_MODELS = [CONFIGURED_MODEL, 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'].filter((model, index, list) => isTextModel(model) && list.indexOf(model) === index);

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify(body));
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  // Keep compatibility with the existing Vercel secret while using the canonical name going forward.
  const apiKey = (process.env.GEMINI_API_KEY || process.env.Gemini_api_key)?.trim();
  if (!apiKey) {
    return json(res, 503, { error: 'Gemini is not configured. Add GEMINI_API_KEY to the Vercel project environment variables.' });
  }

  const body = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch { return {}; } })() : (req.body || {});
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  const locale = ['az', 'ru', 'en'].includes(body.locale) ? body.locale : 'az';
  const language = locale === 'az' ? 'Azerbaijani' : locale === 'ru' ? 'Russian' : 'English';
  if (!prompt) return json(res, 400, { error: 'A non-empty prompt is required.' });
  if (prompt.length > 4000) return json(res, 413, { error: 'Prompt is too long. Limit it to 4000 characters.' });

  const instruction = `You are the planning engine for Skygard AI, a read-first operations console. Analyze the user's task and return ONLY valid JSON with this exact shape: {"summary":"string","steps":[{"title":"string","detail":"string"}]}.
Rules: return 3 to 5 concrete, sequential steps; be honest about unavailable integrations; do not claim that you searched, changed, deployed, or verified anything; describe intended checks in future or planning language; write every summary, step title, and detail in ${language}. User task: ${prompt}`;

  try {
    let availableModels = [];
    const modelDirectory = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
    if (modelDirectory.ok) {
      const directoryPayload = await modelDirectory.json();
      availableModels = (directoryPayload.models || [])
        .filter(item => (item.supportedGenerationMethods || []).includes('generateContent'))
        .map(item => String(item.name || '').replace(/^models\//, ''))
        .filter(isTextModel);
    }
    const preferredAvailable = availableModels.filter(candidate => FALLBACK_MODELS.includes(candidate));
    // Do not silently fall back to aliases such as gemini-flash-latest: they can route
    // to overloaded or non-equivalent models. Use only the explicit text models above.
    const modelsToTry = [...new Set([...preferredAvailable, ...FALLBACK_MODELS])];
    let upstream;
    let payload;
    let model = modelsToTry[0];
    for (const candidate of modelsToTry) {
      model = candidate;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${encodeURIComponent(apiKey)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: instruction }] }],
            generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
          }),
        });
        payload = await upstream.json();
        const transient = [429, 500, 502, 503, 504].includes(upstream.status);
        if (upstream.ok || upstream.status === 404 || !transient || attempt === 2) break;
        await wait((attempt + 1) * 800);
      }
      if (upstream.ok) break;
      if (upstream.status === 404) continue;
      if ([429, 500, 502, 503, 504].includes(upstream.status) && candidate !== modelsToTry[modelsToTry.length - 1]) continue;
      break;
    }
    if (!upstream.ok) {
      const upstreamMessage = String(payload?.error?.message || '').replace(/key=[^&\s]+/gi, 'key=[redacted]').slice(0, 240);
      const reason = upstream.status === 401 || upstream.status === 403 ? 'Gemini rejected the server-side API key. Verify that the key is active and has Generative Language API access.' : upstream.status === 404 ? 'No Gemini model supporting generateContent is available for this API key. Check the key project and model access.' : `Gemini API ${upstream.status}: ${upstreamMessage || 'request failed; check the server-side key and model configuration.'}`;
      console.error('Gemini API error', upstream.status, upstreamMessage || 'unknown');
      return json(res, 502, { error: reason, upstreamStatus: upstream.status, model });
    }

    const text = payload?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
    if (!text) return json(res, 502, { error: 'Gemini returned an empty response.' });
    let result;
    const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/gi, '').trim();
    try {
      result = JSON.parse(cleaned);
    } catch {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try { result = JSON.parse(cleaned.slice(start, end + 1)); } catch { /* use plain text fallback below */ }
      }
    }
    if (!result || typeof result.summary !== 'string' || !Array.isArray(result.steps) || result.steps.length < 1) {
      result = { summary: cleaned.slice(0, 1200), steps: [{ title: 'Gemini response', detail: cleaned.slice(0, 2000) }] };
    }
    const steps = result.steps.slice(0, 5).map(step => ({ title: String(step.title || 'Review task'), detail: String(step.detail || 'Prepare a safe read-first check.') }));
    return json(res, 200, { provider: 'Gemini API', model, summary: result.summary, steps });
  } catch (error) {
    console.error('Gemini route error', error);
    return json(res, 500, { error: 'Unexpected server error while contacting Gemini.' });
  }
}
