import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'
import { buildSystemPrompt } from '@/lib/systemPrompt'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

export async function POST(req: NextRequest) {
  const { message } = await req.json()

  // 過去データを全件取得
  const [
    { data: workoutLogs },
    { data: sets },
    { data: bodyMetrics },
    { data: fatigueNotes },
    { data: chatHistory }
  ] = await Promise.all([
    supabaseAdmin.from('workout_logs').select('*').order('date', { ascending: true }),
    supabaseAdmin.from('workout_sets').select('*').order('set_number', { ascending: true }),
    supabaseAdmin.from('body_metrics').select('*').order('date', { ascending: true }),
    supabaseAdmin.from('fatigue_notes').select('*').order('date', { ascending: true }),
    supabaseAdmin.from('chat_messages').select('*').order('created_at', { ascending: true }).limit(50)
  ])

  // セットをワークアウトログに紐付け
  const logsWithSets = (workoutLogs ?? []).map(log => ({
    ...log,
    sets: (sets ?? []).filter(s => s.workout_log_id === log.id)
  }))

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
    model: 'claude-opus-4-5',
    max_tokens: 2048,
    system: systemPrompt,
    messages
  })

  const assistantMessage = response.content[0].type === 'text'
    ? response.content[0].text
    : ''

  // チャット履歴をDBに保存
  await supabaseAdmin.from('chat_messages').insert([
    { role: 'user', content: message },
    { role: 'assistant', content: assistantMessage }
  ])

  return NextResponse.json({ message: assistantMessage })
}