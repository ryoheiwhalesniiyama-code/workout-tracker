import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

function getSupportedMediaType(fileType: string): SupportedMediaType {
  const map: Record<string, SupportedMediaType> = {
    'image/jpeg': 'image/jpeg',
    'image/jpg': 'image/jpeg',
    'image/png': 'image/png',
    'image/webp': 'image/webp',
    'image/gif': 'image/gif',
    'image/heic': 'image/jpeg',  // HEICはJPEGとして扱う（変換は難しいが最低限通す）
    'image/heif': 'image/jpeg',
  }
  return map[fileType.toLowerCase()] ?? 'image/jpeg'
}

async function extractFromImage(file: File, prompt: string): Promise<Record<string, number | null>> {
  try {
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mediaType = getSupportedMediaType(file.type)

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
    return JSON.parse(cleaned)
  } catch (e) {
    console.error('extractFromImage error:', e)
    return {}
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file1 = formData.get('file1') as File | null  // 体脂肪画面
    const file2 = formData.get('file2') as File | null  // 筋肉画面
    const dateStr = formData.get('date') as string

    if (!file1 && !file2) {
      return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 })
    }
    if (!dateStr) {
      return NextResponse.json({ error: '日付が指定されていません' }, { status: 400 })
    }

    let body_weight: number | null = null
    let body_fat_percent: number | null = null
    let muscle_mass: number | null = null

    // ① 体脂肪画面 → 体重・体脂肪率を取得
    if (file1) {
      const result = await extractFromImage(file1,
        `タニタ体組成計の「体脂肪」画面です。右側パネルの数値を読み取ってください。
右側上部に「Weight NET」と体重(kg)、その下に体脂肪率(%)が表示されています。
数値のみをJSON形式で返してください:
{"body_weight": 体重の数値, "body_fat_percent": 体脂肪率の数値}`)
      if (typeof result.body_weight === 'number') body_weight = result.body_weight
      if (typeof result.body_fat_percent === 'number') body_fat_percent = result.body_fat_percent
    }

    // ② 筋肉画面 → 筋肉量を取得
    if (file2) {
      const result = await extractFromImage(file2,
        `タニタ体組成計の「筋肉」画面です。右側パネルの数値を読み取ってください。
右側上部に「Weight NET」と体重(kg)、その下に筋肉量合計(kg)が表示されています。
数値のみをJSON形式で返してください:
{"body_weight": 体重の数値, "muscle_mass": 筋肉量合計の数値}`)
      if (typeof result.muscle_mass === 'number') muscle_mass = result.muscle_mass
      if (body_weight === null && typeof result.body_weight === 'number') body_weight = result.body_weight
    }

    console.log('Extracted:', { body_weight, body_fat_percent, muscle_mass, date: dateStr })

    // 同日データがあれば削除してから挿入
    const { error: deleteError } = await supabaseAdmin
      .from('body_metrics')
      .delete()
      .eq('date', dateStr)

    if (deleteError) {
      console.error('delete error:', deleteError)
      // 削除失敗は無視して insert を試みる
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('body_metrics')
      .insert({ date: dateStr, body_weight, body_fat_percent, muscle_mass })
      .select()

    if (insertError) {
      console.error('insert error:', insertError)
      return NextResponse.json({
        error: `DB保存エラー: ${insertError.message}`,
        debug: { body_weight, body_fat_percent, muscle_mass, date: dateStr }
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: { body_weight, body_fat_percent, muscle_mass }
    })

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('body-composition POST error:', msg)
    return NextResponse.json({ error: `サーバーエラー: ${msg}` }, { status: 500 })
  }
}
