import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const today = new Date()
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)

    const fromDate = sevenDaysAgo.toISOString().split('T')[0]
    const toDate = today.toISOString().split('T')[0]

    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .select('role, content, session_id')
      .gte('session_id', fromDate)
      .lte('session_id', toDate)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('chat-history fetch error:', error)
      return NextResponse.json({ messages: [] })
    }

    return NextResponse.json({ messages: data ?? [] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('chat-history route error:', msg)
    return NextResponse.json({ messages: [] })
  }
}
