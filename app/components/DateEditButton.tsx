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
          className="bg-gray-800 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 text-white"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-3 py-1.5 text-xs font-medium"
        >
          {saving ? '保存中...' : '保存'}
        </button>
        <button
          onClick={() => { setEditing(false); setDate(currentDate) }}
          className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-3 py-1.5 text-xs"
        >
          キャンセル
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
    >
      ✏️ 日付を編集
    </button>
  )
}
