import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

async function extractFromImage(file: File, prompt: string): Promise<Record<string, number | null>> {
  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp'

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: prompt }
      ]
    }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    return {}
  }
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file1 = formData.get('file1') as File | null  // 体脂肪画面
  const file2 = formData.get('file2') as File | null  // 筋肉画面
  const dateStr = formData.get('date') as string

  if (!file1 && !file2) {
    return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 })
  }

  let body_weight: number | null = null
  let body_fat_percent: number | null = null
  let muscle_mass: number | null = null

  // ① 体脂肪画面 → 体重・体脂肪率を取得
  if (file1) {
    const result = await extractFromImage(file1, `タニタ体組成計の「体脂肪」画面です。右側に表示されている数値を読み取ってください。
以下のJSON形式のみで返してください:
{
  "body_weight": 体重(kg)の数値,
  "body_fat_percent": 体脂肪率(%)の数値
}`)
    body_weight = result.body_weight ?? null
    body_fat_percent = result.body_fat_percent ?? null
  }

  // ② 筋肉画面 → 筋肉量を取得（体重が①で取れなければこちらからも取得）
  if (file2) {
    const result = await extractFromImage(file2, `タニタ体組成計の「筋肉」画面です。右側の数値を読み取ってください。
右上に体重(Weight)、その下に合計筋肉量(kg)が表示されています。
以下のJSON形式のみで返してください:
{
  "body_weight": 体重(kg)の数値,
  "muscle_mass": 筋肉量合計(kg)の数値
}`)
    muscle_mass = result.muscle_mass ?? null
    if (body_weight === null) body_weight = result.body_weight ?? null
  }

  // 同日データがあれば先に削除してから挿入（onConflict が効かない場合の対策）
  await supabaseAdmin.from('body_metrics').delete().eq('date', dateStr)

  const { error } = await supabaseAdmin.from('body_metrics').insert({
    date: dateStr,
    body_weight,
    body_fat_percent,
    muscle_mass,
  })

  if (error) {
    console.error('body_metrics insert error:', error)
    return NextResponse.json({ error: `保存に失敗しました: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    data: { body_weight, body_fat_percent, muscle_mass }
  })
}
