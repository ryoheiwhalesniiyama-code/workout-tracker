import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { data } = await supabaseAdmin
    .from('chat_messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(100)

  return NextResponse.json({
    messages: (data ?? []).map(m => ({
      role: m.role,
      content: m.content
    }))
  })
}
