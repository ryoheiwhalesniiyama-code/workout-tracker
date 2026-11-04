import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'
import { buildSystemPrompt } from '@/lib/systemPrompt'
import { loadCoachContext, loadCoachHistory } from '@/lib/coachContext'
import { jstDate } from '@/lib/coachDates'
import { decodeAssistant, encodeAssistant, planContent } from '@/lib/coachMemory'
import { COACH_TOOL, parseCoachReply } from '@/lib/coachReply'

export const maxDuration = 60
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!, timeout: 50000, maxRetries: 0 })

export async function POST(req: NextRequest) {
  const started = Date.now()
  try {
    const { message } = await req.json()
    if (typeof message !== 'string' || !message.trim() || message.length > 10000) {
      return NextResponse.json({ error: 'メッセージは1〜10000文字で入力してください' }, { status: 400 })
    }
    const today = jstDate()
    const [context, history] = await Promise.all([loadCoachContext(), loadCoachHistory()])
    const references = [...context.workoutLogs.map(l => l.date), ...context.plannedMenus.flatMap(p => p.planned_date ? [p.planned_date] : []),
      ...history.flatMap(m => m.session_id ? [m.session_id] : [])]
    const messages: Anthropic.MessageParam[] = history.map(row => {
      const decoded = row.role === 'assistant' ? decodeAssistant(row.content) : { message: row.content }
      return {
        role: row.role,
        content: `[発言日: ${row.created_at ? jstDate(new Date(row.created_at)) : row.session_id ?? '不明'}]\n${decoded.message}${decoded.draft ? `\n[未保存の提案・合意済みとは限らない]\n${planContent(decoded.draft)}` : ''}`,
      }
    })
    messages.push({ role: 'user', content: `[発言日: ${today}]\n${message.trim()}` })
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5', max_tokens: 4096,
      system: buildSystemPrompt(context, today), messages,
      tools: [COACH_TOOL], tool_choice: { type: 'tool', name: COACH_TOOL.name },
    })
    console.info('coach_request', {
      model: response.model, stopReason: response.stop_reason, usage: response.usage,
      historyCount: history.length, elapsedMs: Date.now() - started,
    })
    if (response.stop_reason === 'max_tokens') {
      return NextResponse.json({ error: '回答が長くなり途中で止まりました。相談を分けて再送してください。' }, { status: 502 })
    }
    const tool = response.content.find(block => block.type === 'tool_use' && block.name === COACH_TOOL.name)
    if (!tool || tool.type !== 'tool_use') throw new Error('コーチの返答を取得できませんでした。もう一度送信してください。')
    const reply = parseCoachReply(tool.input, today, references)
    if (reply.draft) reply.draft.draftId = randomUUID()
    const timestamp = Date.now()
    const { error } = await supabaseAdmin.from('chat_messages').insert([
      { role: 'user', content: message.trim(), session_id: today, created_at: new Date(timestamp).toISOString() },
      { role: 'assistant', content: encodeAssistant(reply.message, reply.draft), session_id: today, created_at: new Date(timestamp + 1).toISOString() },
    ])
    if (error) throw new Error('会話を保存できませんでした。この発言は次回に引き継がれないため、もう一度送信してください。')
    return NextResponse.json({ ...reply, session_id: today, reviews: context.reviews.slice(0, 3),
      contextStart: history[0]?.created_at ? jstDate(new Date(history[0].created_at)) : history[0]?.session_id ?? today })
  } catch (e) {
    const error = e instanceof Error ? e.message : 'コーチとの通信に失敗しました'
    console.error('chat API error:', { elapsedMs: Date.now() - started, error })
    return NextResponse.json({ error }, { status: 500 })
  }
}
