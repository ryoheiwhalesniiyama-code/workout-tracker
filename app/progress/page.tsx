'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

type ProgressData = { date: string; weight: number }

const EXERCISES = ['ベンチプレス', 'スクワット', 'デッドリフト']
const COLORS: Record<string, string> = {
  'ベンチプレス': '#3b82f6',
  'スクワット': '#10b981',
  'デッドリフト': '#f59e0b'
}
const TARGETS: Record<string, number> = {
  'ベンチプレス': 110,
  'スクワット': 120,
  'デッドリフト': 140
}
const SHORT: Record<string, string> = {
  'ベンチプレス': 'ベンチ',
  'スクワット': 'SQ',
  'デッドリフト': 'DL'
}

export default function ProgressPage() {
  const [progress, setProgress] = useState<Record<string, ProgressData[]>>({})
  const [selected, setSelected] = useState('ベンチプレス')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/progress')
      .then(r => r.json())
      .then(data => {
        setProgress(data.progress ?? {})
        setLoading(false)
      })
  }, [])

  const data = progress[selected] ?? []
  const current = data[data.length - 1]?.weight ?? 0
  const target = TARGETS[selected]
  const color = COLORS[selected]

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="flex items-center px-4 py-3 border-b border-gray-800 bg-gray-900">
        <Link href="/" className="text-gray-400 mr-3 text-xl">←</Link>
        <div>
          <h1 className="font-bold text-lg">種目別推移</h1>
          <p className="text-xs text-gray-500">最大重量の変化</p>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">

        {/* 種目タブ */}
        <div className="flex gap-2">
          {EXERCISES.map(ex => (
            <button
              key={ex}
              onClick={() => setSelected(ex)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                selected === ex ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
              }`}
            >
              {SHORT[ex]}
            </button>
          ))}
        </div>

        {/* 現在値 */}
        <div className="bg-gray-900 rounded-2xl p-4 flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-400">{selected}</p>
            <p className="text-3xl font-bold mt-1">
              {current}
              <span className="text-base text-gray-400 ml-1">kg</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">目標</p>
            <p className="text-xl font-bold text-gray-400">
              {target}
              <span className="text-sm ml-1">kg</span>
            </p>
            <p className="text-xs mt-1" style={{ color }}>
              あと {Math.max(target - current, 0)}kg
            </p>
          </div>
        </div>

        {/* グラフ */}
        <div className="bg-gray-900 rounded-2xl p-4">
          <h2 className="font-bold mb-4 text-gray-200 text-sm">重量推移</h2>
          {loading ? (
            <p className="text-gray-500 text-sm text-center py-8">読み込み中...</p>
          ) : data.length < 2 ? (
            <p className="text-gray-500 text-sm text-center py-8">
              データが2件以上になるとグラフが表示されます
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  tickFormatter={d => d.slice(5)}
                />
                <YAxis
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                  labelStyle={{ color: '#9ca3af', fontSize: 12 }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(v: number) => [`${v}kg`, '最大重量']}
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke={color}
                  strokeWidth={2}
                  dot={{ fill: color, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 記録一覧 */}
        {data.length > 0 && (
          <div className="bg-gray-900 rounded-2xl p-4">
            <h2 className="font-bold mb-3 text-gray-200 text-sm">記録一覧</h2>
            <div className="space-y-1">
              {[...data].reverse().slice(0, 10).map((d, i) => (
                <div key={i} className="flex justify-between items-center bg-gray-800 rounded-lg px-3 py-2">
                  <span className="text-xs text-gray-400">{d.date}</span>
                  <span className="text-sm font-medium">{d.weight}kg</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
