import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ messages: [] })

  const { data } = await supabaseAdmin
    .from('chat_messages')
    .select('role, content')
    .eq('session_id', date)
    .order('created_at', { ascending: true })

  return NextResponse.json({ messages: data ?? [] })
}
