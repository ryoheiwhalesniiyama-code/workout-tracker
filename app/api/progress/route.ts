import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const [{ data: sets }, { data: logs }] = await Promise.all([
    supabaseAdmin
      .from('workout_sets')
      .select('exercise_name, weight, reps, workout_log_id')
      .in('exercise_name', ['ベンチプレス', 'スクワット', 'デッドリフト']),
    supabaseAdmin
      .from('workout_logs')
      .select('id, date')
      .order('date', { ascending: true })
  ])

  const logDateMap: Record<string, string> = {}
  for (const log of logs ?? []) logDateMap[log.id] = log.date

  const progressMap: Record<string, Record<string, number>> = {
    'ベンチプレス': {},
    'スクワット': {},
    'デッドリフト': {}
  }

  for (const set of sets ?? []) {
    const date = logDateMap[set.workout_log_id]
    if (!date) continue
    if (!set.reps || set.reps === 0) continue  // 0repは除外
    if (!progressMap[set.exercise_name][date] || progressMap[set.exercise_name][date] < set.weight) {
      progressMap[set.exercise_name][date] = set.weight
    }
  }

  const result: Record<string, { date: string; weight: number }[]> = {}
  for (const [exercise, dateMap] of Object.entries(progressMap)) {
    result[exercise] = Object.entries(dateMap)
      .map(([date, weight]) => ({ date, weight }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  return NextResponse.json({ progress: result })
}
