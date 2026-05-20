import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  const dateStr = formData.get('date') as string

  if (!file) return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp'

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        {
          type: 'text',
          text: `この体組成計（タニタ等）の画像から数値を読み取り、以下のJSON形式で返してください。読み取れない項目はnullにしてください。
{
  "body_weight": 数値,
  "body_fat_percent": 数値,
  "muscle_mass": 数値
}
JSON以外は返さないでください。`
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
    return NextResponse.json({ error: 'データ抽出に失敗しました' }, { status: 500 })
  }

  const { error } = await supabaseAdmin.from('body_metrics').upsert({
    date: dateStr,
    body_weight: parsed.body_weight,
    body_fat_percent: parsed.body_fat_percent,
    muscle_mass: parsed.muscle_mass,
  }, { onConflict: 'date' })

  if (error) return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 })
  return NextResponse.json({ success: true, data: parsed })
}
