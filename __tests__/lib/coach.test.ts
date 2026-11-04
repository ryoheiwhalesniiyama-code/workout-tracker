import { describe, it, expect } from 'vitest'
import { jstDate, resolveSchedule, renderDates, scheduleWarning, isDate } from '@/lib/coachDates'
import { decodeAssistant, encodeAssistant, planContent, reviewCards, selectHistory, validExercises, type PlanDraft, type Workout } from '@/lib/coachMemory'
import { parseCoachReply } from '@/lib/coachReply'

export const draft: PlanDraft = {
  draftId: '12345678-1234-4123-8123-123456789abc',
  plannedDate: '2026-11-07', trainingDay: 'chest',
  exercises: [{ name: 'ベンチプレス', sets: 3, reps: 5, weight: 82.5 }],
  hypothesis: '週末の疲労が影響しているかもしれない', change: 'セット数を減らす', check: '次回の余裕度と肩の張り', notes: '',
}

describe('JST日付と固定スケジュール', () => {
  it('日本時間の0時で切り替わり、朝9時では変わらない', () => {
    expect(jstDate(new Date('2026-11-03T14:59:59Z'))).toBe('2026-11-03')
    expect(jstDate(new Date('2026-11-03T15:00:00Z'))).toBe('2026-11-04')
    expect(jstDate(new Date('2026-11-04T00:00:00Z'))).toBe('2026-11-04')
  })
  it('胸の直後に次回の胸を作ると7日後の土曜になる', () => {
    expect(resolveSchedule({ kind: 'next_training', trainingDay: 'chest' }, '2026-10-31')).toBe('2026-11-07')
    expect(resolveSchedule({ kind: 'after_days', trainingDay: 'chest', days: 7 }, '2026-10-31')).toBe('2026-11-07')
  })
  it('月・年・閏日をまたいでも正しく計算する', () => {
    expect(resolveSchedule({ kind: 'after_days', trainingDay: 'chest', days: 7 }, '2026-12-26')).toBe('2027-01-02')
    expect(resolveSchedule({ kind: 'after_days', trainingDay: 'legs', days: 1 }, '2028-02-28')).toBe('2028-02-29')
    expect(isDate('2026-02-29')).toBe(false)
  })
  it('指定されたログの日付を基準にし、捏造した基準日は拒否する', () => {
    expect(resolveSchedule({ kind: 'after_days', trainingDay: 'chest', referenceDate: '2026-10-31', days: 7 }, '2026-11-04', ['2026-10-31'])).toBe('2026-11-07')
    expect(() => resolveSchedule({ kind: 'after_days', trainingDay: 'chest', referenceDate: '2026-10-30', days: 7 }, '2026-11-04')).toThrow()
  })
  it('曜日はコードで描画し、日付と曜日の食い違いを訂正する', () => {
    expect(renderDates('{{date:2026-11-04}}です', '2026-11-04')).toBe('2026年11月4日（水）です')
    expect(renderDates('2026/11/4（日曜日）です', '2026-11-04')).toBe('2026年11月4日（水）です')
    expect(renderDates('11月7日（日）', '2026-11-04')).toBe('2026年11月7日（土）')
    expect(renderDates('{{date:2027-01-02}}', '2026-12-30')).toBe('2027年1月2日（土）')
  })
  it('ユーザーが明示した例外日を尊重し、通常曜日との違いを表示する', () => {
    expect(resolveSchedule({ kind: 'explicit', trainingDay: 'chest', date: '2026-11-08' }, '2026-11-04')).toBe('2026-11-08')
    expect(scheduleWarning('2026-11-08', 'chest')).toContain('通常')
    expect(scheduleWarning('2026-11-07', 'chest')).toBeNull()
  })
})

describe('継続相談とPDCA', () => {
  it('前日・先週の会話も新しい順の履歴から引き継ぐ', () => {
    const history = selectHistory([
      { role: 'assistant', content: '次は結果を確認', session_id: '2026-11-01' },
      { role: 'user', content: '140kg達成した', session_id: '2026-11-01' },
      { role: 'assistant', content: '次回の仮説', session_id: '2026-10-25' },
      { role: 'user', content: '前回の相談', session_id: '2026-10-25' },
    ])
    expect(history.map(m => m.content)).toEqual(['前回の相談', '次回の仮説', '140kg達成した', '次は結果を確認'])
  })
  it('未合意の提案を原文とともに復元でき、保存内容に仮説と確認項目が残る', () => {
    expect(decodeAssistant(encodeAssistant('この方針を試す？', draft))).toEqual({ message: 'この方針を試す？', draft })
    expect(decodeAssistant('以前の普通の返答')).toEqual({ message: '以前の普通の返答' })
    expect(planContent(draft)).toContain('2026年11月7日（土）')
    expect(planContent(draft)).toContain('次に確認する結果: 次回の余裕度と肩の張り')
  })
  it('日付だけで実施・効果を断定せず、同種目の候補があっても要確認にする', () => {
    const plan = { id: 'p', planned_date: draft.plannedDate, content: '', notes: '確認事項', exercises: draft.exercises }
    const log = { id: 'log', date: draft.plannedDate, sets: [{ exercise_name: 'スクワット' }] } as Workout
    expect(reviewCards([plan], [log], '2026-11-08')[0].status).toBe('実施結果未確認')
    const candidate = { ...log, sets: [{ exercise_name: 'ベンチプレス' }] } as Workout
    const review = reviewCards([plan], [candidate], '2026-11-08')[0]
    expect(review.status).toContain('効果は要確認')
    expect(review.logIds).toEqual(['log'])
    expect(reviewCards([plan], [], '2026-11-04')[0].status).toBe('実施予定')
  })
  it('範囲レップ・無効な重量は保存候補として受け付けない', () => {
    expect(validExercises([{ name: 'ベンチ', sets: 3, reps: '8-10', weight: 60 }])).toBe(false)
    expect(validExercises([{ name: 'ベンチ', sets: 3, reps: 5, weight: -1 }])).toBe(false)
  })
  it('構造化された意図から日付を計算し、不完全な計画は保存しない', () => {
    const reply = parseCoachReply({ message: '前回との違いを確認しよう。', plan: { ...draft, schedule: { kind: 'next_training', trainingDay: 'chest' } } }, '2026-10-31', [])
    expect(reply.draft?.plannedDate).toBe('2026-11-07')
    expect(() => parseCoachReply({ message: '保存しました', plan: {} }, '2026-11-04', [])).toThrow()
  })
})
