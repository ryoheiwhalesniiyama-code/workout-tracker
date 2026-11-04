import type Anthropic from '@anthropic-ai/sdk'
import { renderDates, resolveSchedule, type ScheduleIntent } from './coachDates'
import { validPlanDraft, type PlanDraft } from './coachMemory'

export const COACH_TOOL: Anthropic.Tool = {
  name: 'coach_reply', description: 'コーチの返答と任意の次回メニュー下書きを返す。保存処理ではない。',
  input_schema: {
    type: 'object', required: ['message'], additionalProperties: false,
    properties: {
      message: { type: 'string', description: '日本語の回答。絶対日付は{{date:YYYY-MM-DD}}。メニューはplanで返す。' },
      plan: {
        type: 'object', additionalProperties: false,
        required: ['schedule', 'exercises', 'hypothesis', 'change', 'check', 'notes'],
        properties: {
          schedule: {
            type: 'object', required: ['kind', 'trainingDay'], additionalProperties: false,
            properties: {
              kind: { type: 'string', enum: ['next_training', 'after_days', 'explicit'] },
              trainingDay: { type: 'string', enum: ['chest', 'back', 'legs'] },
              referenceDate: { type: 'string', description: '基準日YYYY-MM-DD。省略時は今日。対象のログや会話にある日付のみ。' },
              days: { type: 'integer', minimum: 1, maximum: 366 },
              date: { type: 'string', description: 'explicit時のみ、ユーザーが指定したYYYY-MM-DD。' },
            },
          },
          exercises: {
            type: 'array', minItems: 1, maxItems: 80,
            items: {
              type: 'object', required: ['name', 'sets', 'reps', 'weight'], additionalProperties: false,
              properties: {
                name: { type: 'string' }, sets: { type: 'integer', minimum: 1, maximum: 100 },
                reps: { type: 'integer', minimum: 1, maximum: 1000 }, weight: { type: ['number', 'null'], minimum: 0, maximum: 1000 },
              },
            },
          },
          hypothesis: { type: 'string' }, change: { type: 'string' }, check: { type: 'string' }, notes: { type: 'string' },
        },
      },
    },
  },
}

export function parseCoachReply(input: unknown, today: string, references: string[]): { message: string; draft?: PlanDraft } {
  if (!input || typeof input !== 'object') throw new Error('コーチの返答形式を確認できませんでした。もう一度送信してください。')
  const value = input as { message?: unknown; plan?: unknown }
  if (typeof value.message !== 'string' || !value.message.trim() || value.message.length > 20000) throw new Error('コーチの返答が不完全です。もう一度送信してください。')
  const message = renderDates(value.message.replace(/【SAVE_MENU:[^】]*】/g, ''), today)
  if (value.plan === undefined || value.plan === null) return { message }
  const plan = value.plan as Record<string, unknown>
  if (!plan.schedule || typeof plan.schedule !== 'object') throw new Error('日程を確認できませんでした。対象の曜日・日付を指定してください。')
  const schedule = plan.schedule as ScheduleIntent
  const draft = {
    plannedDate: resolveSchedule(schedule, today, references), trainingDay: schedule.trainingDay,
    exercises: plan.exercises, hypothesis: plan.hypothesis, change: plan.change, check: plan.check, notes: plan.notes,
  }
  if (!validPlanDraft(draft)) throw new Error('次回メニューの形式が不完全です。もう一度書き出してください。')
  return { message, draft }
}
