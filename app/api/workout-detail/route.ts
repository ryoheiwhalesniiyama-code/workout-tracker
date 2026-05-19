import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { logId, sleepHours, fatigueLevel, motivation, bodyWeight, notes } = await req.json()

  const { error } = await supabaseAdmin
    .from('workout_logs')
    .update({ sleep_hours: sleepHours, fatigue_level: fatigueLevel, motivation, body_weight: bodyWeight, notes })
    .eq('id', logId)

  if (error) {
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}