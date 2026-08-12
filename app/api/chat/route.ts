import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'
import { buildSystemPrompt } from '@/lib/systemPrompt'

export const maxDuration = 60

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

export async function POST(req: NextRequest) {
  try {
    const { message, session_id } = await req.json()

    // Step1: workout_logs を先に取得（セット取得のIDフィルタに使うため）
    const { data: workoutLogs } = await supabaseAdmin
      .from('workout_logs')
      .select('*')
      .order('date', { ascending: false })
      .limit(30)

    const logIds = (workoutLogs ?? []).map((l: Record<string, unknown>) => l.id as string)

    // Step2: 残りのデータを並列取得
    // workout_sets は logIds で絞り込む → limit不要、最近30ログの全セットが確実に取れる
    const [
      { data: sets },
      { data: bodyMetrics },
      { data: fatigueNotes },
      { data: chatHistory }
    ] = await Promise.all([
      logIds.length > 0
        ? supabaseAdmin.from('workout_sets').select('*').in('workout_log_id', logIds).order('set_number', { ascending: true })
        : supabaseAdmin.from('workout_sets').select('*').limit(0),
      supabaseAdmin.from('body_metrics').select('*').order('date', { ascending: false }).limit(20),
      supabaseAdmin.from('fatigue_notes').select('*').order('date', { ascending: false }).limit(10),
      supabaseAdmin.from('chat_messages').select('role, content').eq('session_id', session_id ?? '').order('created_at', { ascending: true })
    ])

    // セットをワークアウトログに紐付け（日付昇順に戻す）
    const logsWithSets = (workoutLogs ?? [])
      .map(log => ({
        ...log,
        sets: (sets ?? []).filter((s: Record<string, unknown>) => s.workout_log_id === log.id)
      }))
      .sort((a, b) => (a.date as string).localeCompare(b.date as string))

    // システムプロンプト構築
    const systemPrompt = buildSystemPrompt({
      workoutLogs: logsWithSets,
      bodyMetrics: bodyMetrics ?? [],
      fatigueNotes: fatigueNotes ?? []
    })

    // チャット履歴を整形
    const messages: Anthropic.MessageParam[] = [
      ...(chatHistory ?? []).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      })),
      { role: 'user', content: message }
    ]

    // Claude API 呼び出し
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      system: systemPrompt,
      messages
    })

    const assistantMessage = response.content[0].type === 'text'
      ? response.content[0].text
      : ''

    // チャット履歴をDBに保存
    await supabaseAdmin.from('chat_messages').insert([
      { role: 'user', content: message, session_id },
      { role: 'assistant', content: assistantMessage, session_id }
    ])

    return NextResponse.json({ message: assistantMessage })

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('chat API error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
