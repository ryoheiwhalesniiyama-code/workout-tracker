import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(req: NextRequest) {
  const { id, date } = await req.json()

  const { error } = await supabaseAdmin
    .from('workout_logs')
    .update({ date })
    .eq('id', id)

  if (error) return NextResponse.json({ error: '更新失敗' }, { status: 500 })
  return NextResponse.json({ success: true })
}
