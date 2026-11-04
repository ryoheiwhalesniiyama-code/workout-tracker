import { supabaseAdmin } from './supabase'
import { HISTORY_LIMIT, selectHistory, reviewCards, type CoachMessage, type SavedPlan, type Workout, type WorkoutSet } from './coachMemory'
import { jstDate } from './coachDates'

export async function loadCoachHistory(): Promise<CoachMessage[]> {
  const { data, error } = await supabaseAdmin.from('chat_messages')
    .select('id, role, content, session_id, created_at')
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(HISTORY_LIMIT)
  if (error) throw new Error('会話履歴を読み込めませんでした。時間をおいて再試行してください。')
  const rows = (data ?? []) as CoachMessage[]
  // 旧実装ではuser/assistantを同一時刻で一括挿入していたため、同時刻は発言順を復元。
  rows.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '') || (a.role === b.role ? 0 : a.role === 'assistant' ? -1 : 1))
  return selectHistory(rows)
}

export async function loadCoachContext() {
  const results = await Promise.all([
    supabaseAdmin.from('workout_logs').select('*').order('date', { ascending: false }).limit(40),
    supabaseAdmin.from('body_metrics').select('*').order('date', { ascending: false }).limit(20),
    supabaseAdmin.from('fatigue_notes').select('*').order('date', { ascending: false }).limit(10),
    supabaseAdmin.from('planned_menus').select('id, planned_date, content, notes, exercises').order('created_at', { ascending: false }).limit(30),
  ])
  if (results.some(r => r.error)) throw new Error('コーチングに必要な記録を取得できませんでした。時間をおいて再試行してください。')
  const logs = results[0].data ?? []
  const plans = (results[3].data ?? []) as SavedPlan[]
  const ids = logs.map(log => log.id as string)
  const setsResult = ids.length
    ? await supabaseAdmin.from('workout_sets').select('*').in('workout_log_id', ids).order('set_number', { ascending: true })
    : { data: [] as WorkoutSet[], error: null }
  if (setsResult.error) throw new Error('トレーニングのセット記録を取得できませんでした。')
  const sets = (setsResult.data ?? []) as WorkoutSet[]
  const workouts = logs.map(log => ({ ...log, sets: sets.filter(set => set.workout_log_id === log.id) })) as Workout[]
  return {
    workoutLogs: workouts,
    bodyMetrics: results[1].data ?? [],
    fatigueNotes: results[2].data ?? [],
    plannedMenus: plans,
    reviews: reviewCards(plans, workouts, jstDate()),
  }
}
