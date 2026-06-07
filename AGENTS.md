<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Coding Rules

## Before every git commit — MANDATORY

Run type check first. Never skip this step:

```
npx tsc --noEmit
```

Fix ALL errors before committing. TypeScript errors caught here prevent Vercel build failures.

## TypeScript rules

- `Promise.resolve({})` → must be typed: `Promise.resolve({} as Record<string, YourType>)`
- API route handlers → always wrap in `try { ... } catch (e) { return NextResponse.json({ error: msg }) }`
- Supabase results → always handle both `data` and `error`

## API route rules

- Every route needs a top-level `try-catch` that returns JSON (never let it throw uncaught)
- Add `export const maxDuration = 60` to any route that calls external APIs (Claude, etc.)
- Claude Vision/OCR calls → use `claude-sonnet-4-5`（haiku-4-5 は複雑なレイアウト〈タニタ体組成計等〉で読み取り精度が低い）
- Claude chat/reasoning → use `claude-sonnet-4-5`

## Vercel constraints (Hobby plan)

- Serverless function timeout: **10 seconds** (maxDuration = 60 is aspirational; actual cap is 10s on Hobby)
- To stay under 10s: use parallel Promise.all, use haiku for vision, limit context size
