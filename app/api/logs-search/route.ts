import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const [{ data: logs }, { data: sets }] = await Promise.all([
    supabaseAdmin.from('workout_logs').select('*').order('date', { ascending: false }).limit(50),
    supabaseAdmin.from('workout_sets').select('workout_log_id, exercise_name')
  ])

  const logExercises: Record<string, string[]> = {}
  for (const set of sets ?? []) {
    if (!logExercises[set.workout_log_id]) logExercises[set.workout_log_id] = []
    if (!logExercises[set.workout_log_id].includes(set.exercise_name)) {
      logExercises[set.workout_log_id].push(set.exercise_name)
    }
  }

  const logsWithExercises = (logs ?? []).map(log => ({
    ...log,
    exercises: logExercises[log.id] ?? []
  }))

  return NextResponse.json({ logs: logsWithExercises })
}
