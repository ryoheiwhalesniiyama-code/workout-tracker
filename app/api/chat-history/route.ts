import { NextResponse } from 'next/server'
import { loadCoachContext, loadCoachHistory } from '@/lib/coachContext'
import { decodeAssistant } from '@/lib/coachMemory'
import { jstDate } from '@/lib/coachDates'

export async function GET() {
  try {
    const [history, context] = await Promise.all([loadCoachHistory(), loadCoachContext()])
    return NextResponse.json({
      messages: history.map(row => ({
        ...row,
        ...(row.role === 'assistant' ? (() => { const decoded = decodeAssistant(row.content); return { content: decoded.message, draft: decoded.draft } })() : {}),
        session_id: row.created_at ? jstDate(new Date(row.created_at)) : row.session_id,
      })),
      reviews: context.reviews.slice(0, 3),
      savedPlanIds: context.plannedMenus.map(p => p.id),
      contextStart: history[0]?.created_at ? jstDate(new Date(history[0].created_at)) : history[0]?.session_id ?? null,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('chat-history fetch failed')
    return NextResponse.json({ error: e instanceof Error ? e.message : '履歴を取得できませんでした' }, { status: 500 })
  }
}
