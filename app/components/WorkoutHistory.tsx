'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type Log = {
  id: string
  date: string
  body_weight: number | null
  fatigue_level: number | null
  notes: string | null
  exercises: string[]
}

const BODY_PARTS: Record<string, string[]> = {
  '胸': ['ベンチプレス', 'インクラインダンベルプレス', 'ダンベルフライ', 'チェストプレス', 'ペックフライ'],
  '背中': ['デッドリフト', 'ラットプルダウン', 'ローイング', 'シーテッドロウ', 'チンニング', 'ワンハンドロウ'],
  '脚': ['スクワット', 'レッグプレス', 'レッグカール', 'レッグエクステンション', 'ブルガリアンスクワット'],
  '腕': ['アームカール', 'ハンマーカール', 'フレンチプレス', 'ライイングエクステンション', 'インクラインダンベルカール', 'ケーブルカール'],
  '肩': ['ショルダープレス', 'サイドレイズ', 'フェイスプル', 'リアデルトフライ'],
}

export default function WorkoutHistory() {
  const [logs, setLogs] = useState<Log[]>([])
  const [filtered, setFiltered] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [selectedPart, setSelectedPart] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/logs-search')
      .then(r => r.json())
      .then(data => {
        setLogs(data.logs ?? [])
        setFiltered(data.logs ?? [])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    let result = logs

    if (selectedPart) {
      const partExercises = BODY_PARTS[selectedPart] ?? []
      result = result.filter(log =>
        log.exercises.some(ex =>
          partExercises.some(pe => ex.includes(pe) || pe.includes(ex))
        )
      )
    }

    if (searchText.trim()) {
      result = result.filter(log =>
        log.exercises.some(ex => ex.includes(searchText.trim()))
      )
    }

    setFiltered(result)
  }, [logs, searchText, selectedPart])

  if (loading) return <p className="text-gray-500 text-sm text-center py-4">読み込み中...</p>

  return (
    <div className="space-y-3">
      {/* 部位フィルター */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedPart(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            !selectedPart ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
          }`}
        >
          全て
        </button>
        {Object.keys(BODY_PARTS).map(part => (
          <button
            key={part}
            onClick={() => setSelectedPart(selectedPart === part ? null : part)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedPart === part ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            {part}
          </button>
        ))}
      </div>

      {/* 種目検索 */}
      <input
        type="text"
        placeholder="種目名で検索（例: ベンチプレス）"
        value={searchText}
        onChange={e => setSearchText(e.target.value)}
        className="w-full bg-gray-800 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 text-white placeholder-gray-500"
      />

      {/* ログ一覧 */}
      {filtered.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">該当するログがありません</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(log => (
            <Link
              key={log.id}
              href={`/workout/${log.id}`}
              className="block bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-xl px-4 py-3 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{log.date}</p>
                  {log.exercises.length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {log.exercises.join(' · ')}
                    </p>
                  )}
                  {log.notes && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{log.notes}</p>
                  )}
                </div>
                <div className="text-right text-xs text-gray-500 ml-2 flex-shrink-0">
                  {log.body_weight && <p>{log.body_weight}kg</p>}
                  {log.fatigue_level && <p>疲労 {log.fatigue_level}/10</p>}
                  <p className="text-gray-600 mt-1">→</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
