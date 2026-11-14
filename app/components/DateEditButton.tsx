'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DateEditButton({ id, currentDate }: { id: string; currentDate: string }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [date, setDate] = useState(currentDate)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await fetch('/api/workout-update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, date })
    })
    setSaving(false)
    setEditing(false)
    router.refresh()
  }

  if (editing) {
    return (
      <div className="flex gap-2 items-center flex-wrap">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="bg-field rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-accent-hover text-foreground"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-accent hover:bg-accent-hover text-white rounded-lg px-3 py-1.5 text-xs font-medium"
        >
          {saving ? '保存中...' : '保存'}
        </button>
        <button
          onClick={() => { setEditing(false); setDate(currentDate) }}
          className="bg-stone-200 hover:bg-stone-300 text-foreground rounded-lg px-3 py-1.5 text-xs"
        >
          キャンセル
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-xs text-stone-600 hover:text-stone-800 transition-colors"
    >
      ✏️ 日付を編集
    </button>
  )
}
