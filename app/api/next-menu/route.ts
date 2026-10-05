import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const MENU_MARKER = '📋 次回メニュー:'
const NOTES_MARKER = '📝 備考:'

/** content から種目テキストと備考を分離する */
function parseContent(content: string): { menuText: string; notes: string | null } {
  const menuIndex = content.indexOf(MENU_MARKER)
  const notesIndex = content.indexOf(NOTES_MARKER)

  // 📋 セクションがない場合はコンテンツ全体を種目テキストとして扱う（後方互換）
  let menuText = content
  if (menuIndex !== -1) {
    const menuStart = menuIndex + MENU_MARKER.length
    const menuEnd = notesIndex !== -1 ? notesIndex : content.length
    menuText = content.substring(menuStart, menuEnd).trim()
  }

  // 📝 セクションがある場合は備考として抽出
  const notes =
    notesIndex !== -1
      ? content.substring(notesIndex + NOTES_MARKER.length).trim() || null
      : null

  return { menuText, notes }
}

export async function POST(req: NextRequest) {
  try {
    const { content, planned_date } = await req.json()

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    // 種目テキストと備考を分離
    const { menuText, notes } = parseContent(content.trim())

    // Claude でエクササイズ情報を構造化抽出
    const extractResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `以下のトレーニングメニューテキストから、すべてのセット情報を抽出してください。

形式: 「・{種目名} {セット数}×{rep数} @ {重量}kg」（1行1セット）

ルール:
- 「・」や「-」で始まる各行が1セット
- sets（セット数）が明示されていなければ 1 として扱う
- 重量がない（「軽め」「自重」など）場合は weight: null
- ヘッダ行・備考行・説明文は無視する
- JSON配列のみ返す（説明文・コードブロック不要）
- フィールド: name（種目名・日本語）, sets（整数）, reps（整数）, weight（数値 or null）

テキスト:
${menuText}

JSON配列のみ返してください:`
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
        exercises,
        notes
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
      .order('planned_date', { ascending: false, nullsFirst: false })

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
