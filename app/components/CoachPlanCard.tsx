'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatCoachDate, scheduleWarning, TRAINING_DAYS } from '@/lib/coachDates'
import type { PlanDraft } from '@/lib/coachMemory'
import { groupExerciseRows } from '@/lib/exerciseRows'

export default function CoachPlanCard({ draft, saved, onSaved }: {
  draft: PlanDraft; saved: boolean; onSaved: (id: string) => void
}) {
  const [plan, setPlan] = useState(draft)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const warning = scheduleWarning(plan.plannedDate, plan.trainingDay)
  async function save() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/next-menu', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draft: plan }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '保存できませんでした')
      onSaved(data.id)
    } catch (e) { setError(e instanceof Error ? e.message : '通信に失敗しました') }
    finally { setSaving(false) }
  }
  if (saved) return <div className="mt-4 rounded-xl border border-green-800 bg-green-950/40 p-3 text-sm">
    計画を保存しました。<Link className="ml-2 underline" href="/plan">次回メニューを確認</Link>
  </div>
  return <section aria-label="次回メニューの確認" className="mt-4 rounded-xl border border-blue-800 bg-gray-900 p-3 sm:p-4">
    <h3 className="font-semibold">次回メニューの確認・保存</h3>
    <p className="mt-1 text-sm text-gray-400">{TRAINING_DAYS[plan.trainingDay].label} · まだ保存されていません</p>
    <label className="mt-3 block text-sm">実施予定日
      <input type="date" style={{ colorScheme: 'dark' }} value={plan.plannedDate} disabled={saving}
        onChange={e => setPlan({ ...plan, plannedDate: e.target.value })}
        className="mt-1 block w-full rounded-lg border border-gray-600 bg-gray-800 p-2 text-white" />
    </label>
    {plan.plannedDate && <p className="mt-2 font-medium text-blue-200">{formatCoachDate(plan.plannedDate)}</p>}
    {warning && <p className="mt-2 text-sm text-amber-300">{warning}</p>}
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead><tr className="text-gray-400"><th className="pb-2">種目</th><th>セット×回数</th><th>重量</th></tr></thead>
        <tbody>{groupExerciseRows(plan.exercises).map((e, i) => <tr key={i} className="border-t border-gray-800">
          <td className="py-2 pr-2">{e.name}</td><td className="whitespace-nowrap pr-2">{e.sets}×{e.reps}</td><td className="whitespace-nowrap">{e.weight === null ? '未指定' : `${e.weight}kg`}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="mt-3 space-y-3">
      {([['hypothesis', '仮説'], ['change', '試す変更'], ['check', '次に確認する結果'], ['notes', '備考']] as const).map(([key, label]) =>
        <label key={key} className="block text-sm text-gray-300">{label}
          <textarea value={plan[key]} maxLength={3000} disabled={saving} rows={2}
            onChange={e => setPlan({ ...plan, [key]: e.target.value })}
            className="mt-1 block w-full resize-y rounded-lg border border-gray-700 bg-gray-800 p-2 leading-relaxed text-white" />
        </label>)}
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    <button type="button" disabled={saving || !plan.plannedDate} onClick={save}
      className="mt-4 w-full rounded-lg bg-blue-600 px-3 py-3 font-medium text-white disabled:opacity-50">
      {saving ? '保存中…' : warning ? '曜日の変更を確認して保存' : 'この日付・方針で保存'}
    </button>
  </section>
}
