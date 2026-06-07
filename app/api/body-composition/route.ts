import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

function getSupportedMediaType(fileType: string): SupportedMediaType {
  const map: Record<string, SupportedMediaType> = {
    'image/jpeg': 'image/jpeg',
    'image/jpg': 'image/jpeg',
    'image/png': 'image/png',
    'image/webp': 'image/webp',
    'image/gif': 'image/gif',
    'image/heic': 'image/jpeg',
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
      model: 'claude-sonnet-4-5',  // haikuは複雑レイアウトの読み取りが不正確
      max_tokens: 256,
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

    // ① と ② を並列処理（直列だと倍の時間がかかるため）
    const empty: Record<string, number | null> = {}
    const [result1, result2] = await Promise.all([
      file1 ? extractFromImage(file1,
        `これはタニタ体組成計MC-780A-Nの「体脂肪」モード画面です。
画面は左右2つのパネルに分かれています。
【右側パネル（小さい液晶）から以下の数値を読み取ってください】
- 右上: "Weight NET" の右の大きな数字 = 体重(kg)
- 右中: 体重の下にある数字(%) = 体脂肪率
※左パネルの部位別数値（TRUNK/ARM/LEG）は無視してください
JSON形式のみで返答:
{"body_weight": 体重の数値, "body_fat_percent": 体脂肪率の数値}`) : Promise.resolve(empty),
      file2 ? extractFromImage(file2,
        `これはタニタ体組成計MC-780A-Nの「筋肉」モード画面です。
画面は左右2つのパネルに分かれています。
【右側パネル（小さい液晶）から以下の数値を読み取ってください】
- 右上: "Weight NET" の右の大きな数字 = 体重(kg)
- 右下: 体重の下にある大きな数字(kg) = 全身の筋肉量合計
※左パネルの部位別数値（TRUNK/ARM/LEG）は無視してください
JSON形式のみで返答:
{"body_weight": 体重の数値, "muscle_mass": 筋肉量合計の数値}`) : Promise.resolve(empty)
    ])

    // 結果をマージ
    let body_weight: number | null = null
    let body_fat_percent: number | null = null
    let muscle_mass: number | null = null

    if (typeof result1.body_weight === 'number') body_weight = result1.body_weight
    if (typeof result1.body_fat_percent === 'number') body_fat_percent = result1.body_fat_percent
    if (typeof result2.muscle_mass === 'number') muscle_mass = result2.muscle_mass
    if (body_weight === null && typeof result2.body_weight === 'number') body_weight = result2.body_weight

    console.log('Extracted:', { body_weight, body_fat_percent, muscle_mass, date: dateStr })

    // 同日データがあれば削除してから挿入
    await supabaseAdmin.from('body_metrics').delete().eq('date', dateStr)

    const { error: insertError } = await supabaseAdmin
      .from('body_metrics')
      .insert({ date: dateStr, body_weight, body_fat_percent, muscle_mass })

    if (insertError) {
      console.error('insert error:', insertError)
      return NextResponse.json({
        error: `DB保存エラー: ${insertError.message}`
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
