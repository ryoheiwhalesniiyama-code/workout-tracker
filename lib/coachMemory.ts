import { formatCoachDate, isDate, type TrainingDay } from './coachDates'

export type Exercise = { name: string; sets: number; reps: number; weight: number | null }
export type PlanDraft = {
  draftId?: string
  plannedDate: string
  trainingDay: TrainingDay
  exercises: Exercise[]
  hypothesis: string
  change: string
  check: string
  notes: string
}
export type SavedPlan = { id: string; planned_date: string | null; content: string; notes: string | null; exercises: Exercise[] | null }
export type WorkoutSet = { exercise_name: string; weight: number; reps: number; set_number: number; workout_log_id: string }
export type Workout = {
  id: string; date: string; notes: string | null; body_weight: number | null
  sleep_hours: number | null; fatigue_level: number | null; motivation: number | null; sets: WorkoutSet[]
}
export type CoachMessage = { id?: string; role: 'user' | 'assistant'; content: string; session_id?: string; created_at?: string }
export type ReviewCard = { id: string; date: string | null; notes: string; status: string; logIds: string[] }

export function validExercises(value: unknown): value is Exercise[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 80 && value.every(e =>
    e && typeof e.name === 'string' && e.name.trim().length > 0 && e.name.length <= 100 &&
    Number.isInteger(e.sets) && e.sets > 0 && e.sets <= 100 &&
    Number.isInteger(e.reps) && e.reps > 0 && e.reps <= 1000 &&
    (e.weight === null || (typeof e.weight === 'number' && Number.isFinite(e.weight) && e.weight >= 0 && e.weight <= 1000)))
}

export function validPlanDraft(value: unknown): value is PlanDraft {
  if (!value || typeof value !== 'object') return false
  const p = value as PlanDraft
  return (p.draftId === undefined || (typeof p.draftId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.draftId))) &&
    isDate(p.plannedDate) && ['chest', 'back', 'legs'].includes(p.trainingDay) && validExercises(p.exercises) &&
    ['hypothesis', 'change', 'check', 'notes'].every(k => typeof p[k as keyof PlanDraft] === 'string' && (p[k as keyof PlanDraft] as string).length <= 3000)
}

export function planNotes(plan: PlanDraft): string {
  return `仮説: ${plan.hypothesis || '未確認'}\n試す変更: ${plan.change || '未確認'}\n次に確認する結果: ${plan.check || '未確認'}${plan.notes ? `\n備考: ${plan.notes}` : ''}`
}

export function planContent(plan: PlanDraft): string {
  return `${formatCoachDate(plan.plannedDate)}の計画\n\n📋 次回メニュー:\n${plan.exercises.map(e =>
    `・${e.name} ${e.sets}×${e.reps}${e.weight === null ? '（重量未指定）' : ` @ ${e.weight}kg`}`).join('\n')}\n\n📝 備考:\n${planNotes(plan)}`
}

/** 下書きは会話の原文と一緒に永続化する。合意済みの計画テーブルとは区別する。 */
export function encodeAssistant(message: string, draft?: PlanDraft): string {
  return draft ? JSON.stringify({ format: 'coach-v1', message, draft }) : message
}
export function decodeAssistant(content: string): { message: string; draft?: PlanDraft } {
  try {
    const value = JSON.parse(content)
    if (value.format === 'coach-v1' && typeof value.message === 'string' && validPlanDraft(value.draft)) {
      return { message: value.message, draft: value.draft }
    }
  } catch { /* 既存のプレーンテキスト履歴もそのまま読む */ }
  return { message: content }
}

const normalize = (name: string) => name.normalize('NFKC').replace(/[\s・]/g, '').toLowerCase()
export function reviewCards(plans: SavedPlan[], workouts: Workout[], today: string): ReviewCard[] {
  return plans.map(plan => {
    const candidates = plan.planned_date ? workouts.filter(log => log.date === plan.planned_date &&
      plan.exercises?.some(e => log.sets.some(s => normalize(e.name) === normalize(s.exercise_name)))) : []
    return {
      id: plan.id, date: plan.planned_date, notes: plan.notes ?? '確認項目は未記録', logIds: candidates.map(l => l.id),
      status: !plan.planned_date ? '予定日未確認' : plan.planned_date > today ? '実施予定' : candidates.length === 1
        ? '同日・同種目の記録あり／実施・効果は要確認' : candidates.length > 1 ? '複数の記録候補／要確認' : '実施結果未確認',
    }
  })
}

// 表示とAPI入力で同じ履歴選択を使う。日付境界では切らず、最新の会話単位で予算内に収める。
export const HISTORY_LIMIT = 120
export const HISTORY_CHAR_BUDGET = 48000
export function selectHistory(newestFirst: CoachMessage[]): CoachMessage[] {
  const result: CoachMessage[] = []
  let chars = 0
  for (const row of newestFirst) {
    if (!['user', 'assistant'].includes(row.role)) continue
    if (chars + row.content.length > HISTORY_CHAR_BUDGET) break
    result.push(row)
    chars += row.content.length
  }
  result.reverse()
  while (result[0]?.role === 'assistant') result.shift()
  return result
}
