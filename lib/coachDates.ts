export const TRAINING_DAYS = {
  chest: { weekday: 6, label: '胸' },
  back: { weekday: 0, label: '背中・軽めベンチ' },
  legs: { weekday: 2, label: '脚・腕' },
} as const
export type TrainingDay = keyof typeof TRAINING_DAYS
const weekdays = ['日', '月', '火', '水', '木', '金', '土']

export function jstDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const part = (type: string) => parts.find(p => p.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function addDays(date: string, days: number): string {
  if (!isDate(date) || !Number.isInteger(days) || Math.abs(days) > 3660) throw new Error('日付を確認してください')
  const result = new Date(`${date}T00:00:00Z`)
  result.setUTCDate(result.getUTCDate() + days)
  return result.toISOString().slice(0, 10)
}

export function formatCoachDate(date: string): string {
  if (!isDate(date)) throw new Error('日付を確認してください')
  const [year, month, day] = date.split('-').map(Number)
  return `${year}年${month}月${day}日（${weekdays[new Date(`${date}T00:00:00Z`).getUTCDay()]}）`
}

export type ScheduleIntent = {
  kind: 'next_training' | 'after_days' | 'explicit'
  trainingDay: TrainingDay
  referenceDate?: string
  days?: number
  date?: string
}

export function resolveSchedule(intent: ScheduleIntent, today: string, allowedReferences: string[] = []): string {
  if (!(intent.trainingDay in TRAINING_DAYS)) throw new Error('トレーニング曜日を確認してください')
  if (intent.kind === 'explicit') {
    if (!isDate(intent.date)) throw new Error('実施日を確認してください')
    return intent.date
  }
  const reference = intent.referenceDate ?? today
  if (!isDate(reference) || (reference !== today && !allowedReferences.includes(reference))) {
    throw new Error('基準日を会話または記録で確認してください')
  }
  if (intent.kind === 'after_days') {
    if (!Number.isInteger(intent.days) || intent.days! < 1 || intent.days! > 366) throw new Error('日数を確認してください')
    return addDays(reference, intent.days!)
  }
  if (intent.kind !== 'next_training') throw new Error('日程を確認してください')
  const current = new Date(`${reference}T00:00:00Z`).getUTCDay()
  const delta = (TRAINING_DAYS[intent.trainingDay].weekday - current + 7) % 7 || 7
  return addDays(reference, delta)
}

export function scheduleWarning(date: string, trainingDay: TrainingDay): string | null {
  if (!isDate(date)) return '実施日を確認してください'
  return new Date(`${date}T00:00:00Z`).getUTCDay() === TRAINING_DAYS[trainingDay].weekday
    ? null : `通常の${TRAINING_DAYS[trainingDay].label}の曜日と異なります。この日付で実施する場合は確認して保存してください。`
}

/** 曜日の文章はモデルの計算を採用せず、ISO日付のプレースホルダーから描画する。 */
export function renderDates(text: string, today: string): string {
  let rendered = text.replace(/\{\{date:(\d{4}-\d{2}-\d{2})\}\}/g, (_, date: string) => isDate(date) ? formatCoachDate(date) : '（日付未確認）')
  rendered = rendered.replace(/(\d{4})[年/\-](\d{1,2})[月/\-](\d{1,2})日?(?:\s*[（(][日月火水木金土](?:曜日)?[）)])?/g,
    (original, y: string, m: string, d: string) => {
      const date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
      return isDate(date) ? formatCoachDate(date) : original
    })
  rendered = rendered.replace(/(?<![\d年])(\d{1,2})月(\d{1,2})日\s*[（(][日月火水木金土](?:曜日)?[）)]/g,
    (original, m: string, d: string) => {
      const date = `${today.slice(0, 4)}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
      return isDate(date) ? formatCoachDate(date) : original
    })
  return rendered
}
