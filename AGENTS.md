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

---

## 次回メニュー書き出し機能（SAVE_MENUフロー）

### データの流れ

```
① フロント（chat/page.tsx）
   「📋 書き出す」ボタン →「次回メニューを書き出したい」を自動送信

② Claude（lib/systemPrompt.ts で制御）
   会話履歴から種目リストを整理 → 日程確認メッセージを返す

③ ユーザーが「はい」or 日付を指定

④ Claude
   種目リスト＋確認文＋【SAVE_MENU:YYYY-MM-DD】マーカーを返す

⑤ フロント（chat/page.tsx）
   lib/saveMenuParser.ts でマーカー検出
   → cleanContent（マーカー除去後テキスト）と plannedDate を抽出
   → POST /api/next-menu

⑥ API（app/api/next-menu/route.ts）
   Claude API で cleanContent から exercises を JSON 抽出
   → planned_menus テーブルに保存

⑦ フロント（plan/page.tsx）
   exercises JSONB をテーブル形式で表示
```

### Supabase テーブル: planned_menus

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid | PK |
| created_at | timestamptz | 保存日時 |
| planned_date | date \| null | 次回予定日 |
| content | text | cleanContent（マーカー除去後の全文） |
| exercises | jsonb \| null | `[{name, sets, reps, weight}]` Claude抽出 |

### ⚠️ 重要な設計上の注意

**Claudeの確認メッセージ（マーカー付き）に種目リストが含まれていないと exercises: null になる。**

- `content` = cleanContent（マーカーを除いた Claude の返答テキスト全文）
- `exercises` = content から Claude API が抽出した JSONB（plan ページのテーブル表示に使用）
- content に種目情報がなければ抽出できず、テーブルではなく生テキスト表示になる
- `lib/systemPrompt.ts` の例示に種目リストを含めることで制御している（例示を変えると崩れる）

### 関連ファイル

- `lib/systemPrompt.ts` — SAVE_MENU フローの指示と例示
- `lib/saveMenuParser.ts` — マーカー検出・除去ユーティリティ
- `app/api/next-menu/route.ts` — POST（保存）/ GET（一覧）
- `app/plan/page.tsx` — 保存済みメニュー一覧画面
- `app/chat/page.tsx` — マーカー検出 → saveNextMenu() 呼び出し
- `__tests__/lib/saveMenuParser.test.ts` — パーサーのユニットテスト
- `__tests__/api/next-menu.test.ts` — API のユニットテスト
- `__tests__/pages/plan.test.tsx` — plan ページのコンポーネントテスト
