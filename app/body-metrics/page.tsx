'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

type BodyMetric = {
  date: string
  body_weight: number | null
  muscle_mass: number | null
  body_fat_percent: number | null
}

type MetricKey = 'body_weight' | 'muscle_mass' | 'body_fat_percent'

const METRICS: { key: MetricKey; label: string; unit: string; color: string; short: string }[] = [
  { key: 'body_weight', label: '体重', unit: 'kg', color: '#245643', short: '体重' },
  { key: 'muscle_mass', label: '筋肉量', unit: 'kg', color: '#34785d', short: '筋肉量' },
  { key: 'body_fat_percent', label: '体脂肪率', unit: '%', color: '#9a622e', short: '脂肪率' },
]

export default function BodyMetricsPage() {
  const [metrics, setMetrics] = useState<BodyMetric[]>([])
  const [selected, setSelected] = useState<MetricKey>('body_weight')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/body-metrics-history')
      .then(r => r.json())
      .then(data => {
        setMetrics(data.metrics ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const selectedMeta = METRICS.find(m => m.key === selected)!
  const chartData = metrics
    .filter(m => m[selected] !== null)
    .map(m => ({ date: m.date, value: m[selected] }))

  const latest = chartData.length > 0 ? chartData[chartData.length - 1].value : null
  const oldest = chartData.length > 1 ? chartData[0].value : null
  const diff = latest !== null && oldest !== null ? Number((Number(latest) - Number(oldest)).toFixed(1)) : null

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex items-center px-4 py-3 border-b border-stone-200 bg-surface">
        <Link href="/" className="text-stone-600 mr-3 text-xl">←</Link>
        <div>
          <h1 className="font-bold text-lg">体組成推移</h1>
          <p className="text-xs text-stone-600">体重・筋肉量・体脂肪率の変化</p>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">

        {/* 指標タブ */}
        <div className="flex gap-2">
          {METRICS.map(m => (
            <button
              key={m.key}
              onClick={() => setSelected(m.key)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                selected === m.key ? 'text-white' : 'bg-field text-stone-600'
              }`}
              style={selected === m.key ? { backgroundColor: m.color } : undefined}
            >
              {m.short}
            </button>
          ))}
        </div>

        {/* 最新値カード */}
        <div className="bg-surface rounded-2xl p-4 flex justify-between items-center">
          <div>
            <p className="text-sm text-stone-600">{selectedMeta.label}</p>
            <p className="text-3xl font-bold mt-1">
              {latest !== null ? latest : '-'}
              <span className="text-base text-stone-600 ml-1">{selectedMeta.unit}</span>
            </p>
          </div>
          {diff !== null && (
            <div className="text-right">
              <p className="text-xs text-stone-600">初回比</p>
              <p className={`text-xl font-bold mt-1 ${
                selectedMeta.key === 'body_fat_percent'
                  ? (diff <= 0 ? 'text-accent' : 'text-red-800')
                  : selectedMeta.key === 'muscle_mass'
                  ? (diff >= 0 ? 'text-accent' : 'text-red-800')
                  : 'text-stone-800'
              }`}>
                {diff > 0 ? '+' : ''}{diff}{selectedMeta.unit}
              </p>
            </div>
          )}
        </div>

        {/* グラフ */}
        <div className="bg-surface rounded-2xl p-4">
          <h2 className="font-bold mb-4 text-stone-800 text-sm">{selectedMeta.label}推移</h2>
          {loading ? (
            <p className="text-stone-600 text-sm text-center py-8">読み込み中...</p>
          ) : chartData.length < 2 ? (
            <p className="text-stone-600 text-sm text-center py-8">
              データが2件以上になるとグラフが表示されます
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ded8ca" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#57534e', fontSize: 10 }}
                  tickFormatter={d => String(d).slice(5)}
                />
                <YAxis
                  tick={{ fill: '#57534e', fontSize: 10 }}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fffdf8', border: 'none', borderRadius: '8px' }}
                  labelStyle={{ color: '#57534e', fontSize: 12 }}
                  itemStyle={{ color: '#292524' }}
                  formatter={(v: unknown) => [`${v ?? '-'}${selectedMeta.unit}`, selectedMeta.label] as [string, string]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={selectedMeta.color}
                  strokeWidth={2}
                  dot={{ fill: selectedMeta.color, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* データなし */}
        {!loading && metrics.length === 0 && (
          <div className="bg-surface rounded-2xl p-6 text-center">
            <p className="text-4xl mb-3">⚖️</p>
            <p className="text-stone-600 text-sm">体組成データがまだありません</p>
            <p className="text-stone-700 text-xs mt-2">ログ記録画面でタニタの①体脂肪・②筋肉画面をアップロードしてください</p>
            <Link href="/log" className="inline-block mt-4 bg-accent hover:bg-accent-hover rounded-xl px-4 py-2 text-sm font-medium transition-colors text-white">
              ログを記録する
            </Link>
          </div>
        )}

        {/* 記録一覧 */}
        {metrics.length > 0 && (
          <div className="bg-surface rounded-2xl p-4">
            <h2 className="font-bold mb-3 text-stone-800 text-sm">記録一覧（直近10件）</h2>
            <div className="space-y-1">
              {[...metrics].reverse().slice(0, 10).map((m, i) => (
                <div key={i} className="flex justify-between items-center bg-field rounded-lg px-3 py-2">
                  <span className="text-xs text-stone-600">{m.date}</span>
                  <div className="flex gap-4 text-sm">
                    <span>{m.body_weight ?? '-'}<span className="text-xs text-stone-600">kg</span></span>
                    <span>{m.muscle_mass ?? '-'}<span className="text-xs text-stone-600">kg</span></span>
                    <span>{m.body_fat_percent ?? '-'}<span className="text-xs text-stone-600">%</span></span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-stone-700 px-3 mt-1">
              <span></span>
              <div className="flex gap-4">
                <span>体重</span>
                <span>筋肉量</span>
                <span>脂肪率</span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
