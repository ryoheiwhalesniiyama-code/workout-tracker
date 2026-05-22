import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File

  if (!file) return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp'

  // Claude Vision でデータ抽出（日付も画像から読み取る）
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        {
          type: 'text',
          text: `このトレーニングログ画像から全データを抽出してください。
画像の上部に「YYYY-MM-DD WorkOut」形式で日付が書かれているので必ず読み取ってください。

以下のJSON形式のみで返してください。他の文字は不要です。
{
  "date": "YYYY-MM-DD",
  "exercises": [
    {
      "name": "種目名",
      "sets": [
        { "set_number": 1, "weight": 60, "reps": 5 }
      ]
    }
  ]
}`
        }
      ]
    }]
  })

  const jsonText = response.content[0].type === 'text' ? response.content[0].text : '{}'
  const cleaned = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  let parsed
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ error: 'データ抽出に失敗しました', raw: jsonText }, { status: 500 })
  }

  if (!parsed.date) {
    return NextResponse.json({ error: '日付の読み取りに失敗しました', raw: jsonText }, { status: 500 })
  }

  // 同じ日付のログが既にあれば上書き（重複防止）
  const { data: existing } = await supabaseAdmin
    .from('workout_logs')
    .select('id')
    .eq('date', parsed.date)
    .single()

  if (existing) {
    // 既存のセットを削除
    await supabaseAdmin.from('workout_sets').delete().eq('workout_log_id', existing.id)
    // ログを削除
    await supabaseAdmin.from('workout_logs').delete().eq('id', existing.id)
  }

  // ワークアウトログを保存
  const { data: log, error: logError } = await supabaseAdmin
    .from('workout_logs')
    .insert({ date: parsed.date, raw_data: parsed })
    .select()
    .single()

  if (logError || !log) {
    return NextResponse.json({ error: 'ログ保存に失敗しました' }, { status: 500 })
  }

  // セットデータを保存
  const BIG3 = ['ベンチプレス', 'スクワット', 'デッドリフト']
  const setsToInsert = parsed.exercises?.flatMap((ex: any) =>
    (ex.sets ?? []).map((s: any) => ({
      workout_log_id: log.id,
      exercise_name: ex.name,
      set_number: s.set_number,
      weight: s.weight,
      reps: s.reps,
      is_main_lift: BIG3.includes(ex.name)
    }))
  ) ?? []

  if (setsToInsert.length > 0) {
    await supabaseAdmin.from('workout_sets').insert(setsToInsert)
  }

  return NextResponse.json({
    success: true,
    date: parsed.date,
    exercises: parsed.exercises?.map((e: any) => e.name) ?? []
  })
}
