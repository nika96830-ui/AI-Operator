 # Skygard AI

Skygard AI is a local-first, read-first autonomous control plane for turning natural-language requests into verified technical work.

## Gemini API (server-side)

The `Gemini API` provider calls the same-origin Vercel Function at `POST /api/gemini`. The browser sends only the task text. The function reads `GEMINI_API_KEY` from the Vercel project environment, calls Gemini, validates the structured JSON plan, and returns the steps to the UI. The key is never shipped to the browser or committed to Git.

Configure these Vercel environment variables before selecting **Gemini API** in Settings:

```text
GEMINI_API_KEY=your-server-side-key
GEMINI_MODEL=gemini-2.5-flash
```

Set `GEMINI_API_KEY` for the Production environment in Vercel Project Settings → Environment Variables, then redeploy. If it is missing, the endpoint returns a clear `503` response and the UI records a failed task instead of falling back silently.

For local development of the serverless route, create an untracked `.env.local` file with the same variables and run the project through `vercel dev` after linking the project. Plain `npm run dev` is sufficient for the frontend build, but it does not emulate `/api/gemini`. Never paste a production key into frontend code or commit `.env.local`.
