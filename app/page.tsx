import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

async function getData() {
  const [{ data: logs }, { data: sets }, { data: metrics }] = await Promise.all([
    supabaseAdmin.from('workout_logs').select('*').order('date', { ascending: false }).limit(10),
    supabaseAdmin.from('workout_sets').select('*').eq('is_main_lift', true).order('created_at', { ascending: false }),
    supabaseAdmin.from('body_metrics').select('*').order('date', { ascending: false }).limit(1)
  ])
  return { logs: logs ?? [], sets: sets ?? [], latestMetric: metrics?.[0] ?? null }
}

export default async function HomePage() {
  const { logs, sets, latestMetric } = await getData()

  const getPR = (exercise: string) => {
    const filtered = sets.filter(s => s.exercise_name === exercise)
    if (filtered.length === 0) return null
    return Math.max(...filtered.map(s => s.weight))
  }

  const benchPR = getPR('ベンチプレス') ?? 100
  const squatPR = getPR('スクワット') ?? 110
  const deadliftPR = getPR('デッドリフト') ?? 120
  const total = benchPR + squatPR + deadliftPR

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ヘッダー */}
      <div className="px-4 py-4 border-b border-gray-800 bg-gray-900">
        <h1 className="text-xl font-bold">💪 Workout Tracker</h1>
        <p className="text-gray-400 text-sm mt-0.5">目標: Big3 370kg total</p>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">

        {/* アクションボタン（上部） */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/log" className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-2xl p-5 text-center transition-colors">
            <p className="text-3xl mb-2">📷</p>
            <p className="font-bold">ログを記録</p>
            <p className="text-xs text-blue-200 mt-1">スクショをアップロード</p>
          </Link>
          <Link href="/chat" className="bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-2xl p-5 text-center transition-colors">
            <p className="text-3xl mb-2">🤖</p>
            <p className="font-bold">AIコーチ</p>
            <p className="text-xs text-gray-400 mt-1">レビュー・相談</p>
          </Link>
        </div>

        {/* Big3 進捗（中部） */}
        <div className="bg-gray-900 rounded-2xl p-4">
          <h2 className="font-bold mb-3 text-gray-200">Big3 現在値</h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { name: 'ベンチ', current: benchPR, target: 110 },
              { name: 'スクワット', current: squatPR, target: 120 },
              { name: 'デッドリフト', current: deadliftPR, target: 140 },
            ].map(({ name, current, target }) => (
              <div key={name} className="bg-gray-800 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">{name}</p>
                <p className="text-xl font-bold text-white">{current}</p>
                <p className="text-xs text-gray-500">目標 {target}kg</p>
                <div className="mt-2 bg-gray-700 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full"
                    style={{ width: `${Math.min((current / target) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="bg-gray-800 rounded-xl p-3 flex justify-between items-center">
            <span className="text-gray-400 text-sm">トータル</span>
            <div className="text-right">
              <span className="text-2xl font-bold text-blue-400">{total}kg</span>
              <span className="text-gray-500 text-sm ml-2">/ 370kg</span>
            </div>
          </div>
        </div>

        {/* 体組成 */}
        {latestMetric && (
          <div className="bg-gray-900 rounded-2xl p-4">
            <h2 className="font-bold mb-3 text-gray-200">最新の体組成</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '体重', value: latestMetric.body_weight, unit: 'kg' },
                { label: '筋肉量', value: latestMetric.muscle_mass, unit: 'kg' },
                { label: '体脂肪率', value: latestMetric.body_fat_percent, unit: '%' },
              ].map(({ label, value, unit }) => (
                <div key={label} className="bg-gray-800 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="text-lg font-bold mt-1">{value ?? '-'}<span className="text-xs text-gray-400">{unit}</span></p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* トレーニング履歴（下部） */}
        <div className="bg-gray-900 rounded-2xl p-4">
          <h2 className="font-bold mb-3 text-gray-200">トレーニング履歴</h2>
          {logs.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">まだログがありません</p>
          ) : (
            <div className="space-y-2">
              {logs.map(log => (
                <Link
                  key={log.id}
                  href={`/workout/${log.id}`}
                  className="block bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-xl px-4 py-3 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">{log.date}</p>
                      {log.notes && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{log.notes}</p>
                      )}
                    </div>
                    <div className="text-right text-xs text-gray-500">
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

      </div>
    </div>
  )
}
