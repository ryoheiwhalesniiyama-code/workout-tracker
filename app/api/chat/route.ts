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

    // 過去データを取得（直近に絞ってトークン節約）
    const [
      { data: workoutLogs },
      { data: sets },
      { data: bodyMetrics },
      { data: fatigueNotes },
      { data: chatHistory }
    ] = await Promise.all([
      supabaseAdmin.from('workout_logs').select('*').order('date', { ascending: false }).limit(30),
      supabaseAdmin.from('workout_sets').select('*').order('set_number', { ascending: true }).limit(500),
      supabaseAdmin.from('body_metrics').select('*').order('date', { ascending: false }).limit(20),
      supabaseAdmin.from('fatigue_notes').select('*').order('date', { ascending: false }).limit(10),
      supabaseAdmin.from('chat_messages').select('role, content').eq('session_id', session_id ?? '').order('created_at', { ascending: true })
    ])

    // セットをワークアウトログに紐付け（日付昇順に戻す）
    const logsWithSets = (workoutLogs ?? [])
      .map(log => ({
        ...log,
        sets: (sets ?? []).filter(s => s.workout_log_id === log.id)
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

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
      max_tokens: 1024,
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
    // エラー内容をそのままクライアントに返す（デバッグ用）
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
