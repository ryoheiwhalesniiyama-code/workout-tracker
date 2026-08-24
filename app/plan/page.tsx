'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type Exercise = { name: string; sets: number | null; reps: number | null; weight: number | null }
type PlannedMenu = {
  id: string
  created_at: string
  planned_date: string | null
  content: string
  exercises: Exercise[] | null
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '日付未設定'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
  })
}

/** マークダウン記号を除去してプレーンテキスト化する */
function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')        // # 見出し
    .replace(/\*\*(.+?)\*\*/g, '$1')    // **太字**
    .replace(/\*(.+?)\*/g, '$1')        // *斜体*
    .replace(/^[-*]\s+/gm, '・')        // - リスト → ・
    .replace(/^---+$/gm, '')            // 水平線
    .replace(/\n{3,}/g, '\n\n')         // 連続改行を整理
    .trim()
}

export default function PlanPage() {
  const [menus, setMenus] = useState<PlannedMenu[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/next-menu')
      .then(r => r.json())
      .then(data => {
        setMenus(data.menus ?? [])
        setLoading(false)
      })
      .catch(() => {
        setError('読み込みに失敗しました')
        setLoading(false)
      })
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="flex items-center px-4 py-3 border-b border-gray-800 bg-gray-900">
        <Link href="/" className="text-gray-400 mr-3 text-xl">←</Link>
        <div>
          <h1 className="font-bold text-lg">次回メニュー</h1>
          <p className="text-xs text-gray-500">AIコーチが提案した次回プラン</p>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-4">
        {loading ? (
          <p className="text-center text-gray-500 text-sm mt-20">読み込み中...</p>
        ) : error ? (
          <p className="text-center text-red-400 text-sm mt-20">{error}</p>
        ) : menus.length === 0 ? (
          <div className="text-center text-gray-500 mt-20">
            <p className="text-4xl mb-4">📋</p>
            <p>まだ次回メニューがありません</p>
            <p className="text-sm mt-2">AIコーチで「書き出す」ボタンを押すと保存されます</p>
          </div>
        ) : (
          menus.map((menu, index) => (
            <div key={menu.id} className="bg-gray-900 rounded-2xl p-4 space-y-3">
              {/* ヘッダー */}
              <div className="flex justify-between items-start">
                <div>
                  {index === 0 && (
                    <span className="text-xs bg-blue-600 text-white rounded-full px-2 py-0.5 mr-2">最新</span>
                  )}
                  <span className="text-sm font-bold text-blue-300">
                    📅 {formatDate(menu.planned_date)}
                  </span>
                </div>
                <span className="text-xs text-gray-600">
                  保存: {new Date(menu.created_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                </span>
              </div>

              {/* 種目一覧（構造化データがある場合） */}
              {menu.exercises && menu.exercises.length > 0 ? (
                <div className="space-y-2">
                  {menu.exercises.map((ex, i) => (
                    <div key={i} className="bg-gray-800 rounded-xl px-3 py-2 flex justify-between items-center">
                      <span className="text-sm font-medium">{ex.name}</span>
                      <span className="text-xs text-gray-400">
                        {ex.sets != null && ex.reps != null
                          ? `${ex.sets}×${ex.reps}rep${ex.weight != null ? ` @ ${ex.weight}kg` : ''}`
                          : '詳細未設定'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                // 構造化データなしの場合はマークダウン除去したテキストを表示
                <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {stripMarkdown(menu.content)}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
