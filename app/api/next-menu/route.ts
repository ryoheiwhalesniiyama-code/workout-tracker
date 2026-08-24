import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  try {
    const { content, planned_date } = await req.json()

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    // Claude でエクササイズ情報を構造化抽出
    const extractResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `以下のトレーニングメニューテキストから種目情報を抽出してください。
JSON配列のみ返してください。フィールド: name（種目名）, sets（セット数・数値）, reps（レップ数・数値）, weight（重量kg・数値）
情報がない場合は null にしてください。

テキスト:
${content}

例: [{"name":"ベンチプレス","sets":5,"reps":5,"weight":82.5}]`
      }]
    })

    let exercises = null
    const rawJson = extractResponse.content[0].type === 'text' ? extractResponse.content[0].text : '[]'
    try {
      const cleaned = rawJson.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      exercises = JSON.parse(cleaned)
    } catch {
      console.error('exercises parse error:', rawJson)
      // 抽出失敗でも保存は続行
    }

    const { data, error } = await supabaseAdmin
      .from('planned_menus')
      .insert({
        content: content.trim(),
        planned_date: planned_date ?? null,
        exercises
      })
      .select('id')
      .single()

    if (error || !data) {
      console.error('planned_menus insert error:', error)
      return NextResponse.json({ error: 'DB保存に失敗しました', detail: error?.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data.id })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('next-menu POST error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('planned_menus')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('planned_menus fetch error:', error)
      return NextResponse.json({ menus: [] })
    }

    return NextResponse.json({ menus: data ?? [] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('next-menu GET error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
