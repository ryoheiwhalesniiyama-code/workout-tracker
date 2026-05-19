import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  const dateStr = formData.get('date') as string

  if (!file) {
    return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 })
  }

  // 画像をbase64に変換
  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp'

  // Claude Vision でデータ抽出
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64 }
        },
        {
          type: 'text',
          text: `このトレーニングログ画像から全データを抽出して、以下のJSON形式で返してください。
{
  "exercises": [
    {
      "name": "種目名",
      "sets": [
        { "set_number": 1, "weight": 60, "reps": 5 }
      ]
    }
  ],
  "notes": "気づいたこと"
}
JSON以外は返さないでください。`
        }
      ]
    }]
  })

  const jsonText = response.content[0].type === 'text' ? response.content[0].text : '{}'

  // マークダウンのコードブロックを除去
  const cleanedJson = jsonText
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()

  let parsed
  try {
    parsed = JSON.parse(cleanedJson)
  } catch {
    console.error('JSON parse error. Raw response:', jsonText)
    return NextResponse.json({ error: 'データ抽出に失敗しました', raw: jsonText }, { status: 500 })
  }

  // ワークアウトログをDBに保存
  const { data: log, error: logError } = await supabaseAdmin
    .from('workout_logs')
    .insert({
      date: dateStr,
      notes: parsed.notes ?? '',
      raw_data: parsed
    })
    .select()
    .single()

  if (logError || !log) {
    return NextResponse.json({ error: 'ログ保存に失敗しました' }, { status: 500 })
  }

  // セットデータを保存
  const setsToInsert = parsed.exercises?.flatMap((ex: any) =>
    ex.sets.map((s: any) => ({
      workout_log_id: log.id,
      exercise_name: ex.name,
      set_number: s.set_number,
      weight: s.weight,
      reps: s.reps,
      is_main_lift: ['ベンチプレス', 'スクワット', 'デッドリフト'].includes(ex.name)
    }))
  ) ?? []

  if (setsToInsert.length > 0) {
    await supabaseAdmin.from('workout_sets').insert(setsToInsert)
  }

  return NextResponse.json({ success: true, logId: log.id, data: parsed })
}