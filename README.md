# AI Operator

A local-first, read-first operations console for turning natural-language requests into verified technical work. It never claims an action that was not executed and verified.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:4173`.

## What works now

- Natural-language task input with an execution pipeline: Understanding → Planning → Executing → Validating → Completed.
- Real local workspace inspection.
- Real GitHub identity and repository checks through the authenticated `gh` CLI.
- Persistent audit history in `data/history.json`.
- Honest service status for GitHub, Vercel, Supabase, Gmail, OpenAI and Browser.
- Safety boundary: write, deployment, deletion and financial intent is detected and paused rather than silently performed.
- No secrets are shown in the UI or persisted to the audit log.

## Current limitations

This is ordinary local mode. Vercel, Supabase and Gmail are intentionally marked **NOT CONNECTED** because no authorized connector is available in this workspace. The application reports that fact instead of returning fake provider data. Connecting those services requires a user-authorized integration and a provider-specific adapter.
