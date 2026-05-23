import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import WorkoutHistory from '@/app/components/WorkoutHistory'

export const dynamic = 'force-dynamic'

async function getData() {
  const [{ data: sets }, { data: metrics }] = await Promise.all([
    supabaseAdmin.from('workout_sets').select('*').eq('is_main_lift', true),
    supabaseAdmin.from('body_metrics').select('*').order('date', { ascending: false }).limit(1)
  ])
  return { sets: sets ?? [], latestMetric: metrics?.[0] ?? null }
}

export default async function HomePage() {
  const { sets, latestMetric } = await getData()

  const getPR = (exercise: string) => {
    const filtered = sets.filter(s => s.exercise_name === exercise && s.reps > 0)
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
        <h1 className="text-xl font-bold flex items-center gap-2">
          <img src="/icon.png" alt="icon" className="w-8 h-8 rounded-lg" />
          Workout Tracker
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">目標: Big3 370kg total</p>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">

        {/* アクションボタン（上部） */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/log" className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-2xl p-4 text-center transition-colors">
            <p className="text-3xl mb-1">📷</p>
            <p className="font-bold text-sm">ログを記録</p>
            <p className="text-xs text-blue-200 mt-0.5">スクショをアップロード</p>
          </Link>
          <Link href="/chat" className="bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-2xl p-4 text-center transition-colors">
            <p className="text-3xl mb-1">🤖</p>
            <p className="font-bold text-sm">AIコーチ</p>
            <p className="text-xs text-gray-400 mt-0.5">レビュー・相談</p>
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/progress" className="block bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-2xl p-4 text-center transition-colors">
            <p className="text-2xl mb-1">📈</p>
            <p className="font-bold text-sm">推移グラフ</p>
            <p className="text-xs text-gray-400 mt-0.5">Big3の重量変化</p>
          </Link>
          <Link href="/import" className="block bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-2xl p-4 text-center transition-colors">
            <p className="text-2xl mb-1">📦</p>
            <p className="font-bold text-sm">一括インポート</p>
            <p className="text-xs text-gray-400 mt-0.5">過去データを取り込む</p>
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
          <Link href="/body-metrics" className="block bg-gray-900 rounded-2xl p-4 hover:bg-gray-800 transition-colors">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-gray-200">最新の体組成</h2>
              <span className="text-xs text-gray-500">推移グラフ →</span>
            </div>
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
          </Link>
        )}

        {/* トレーニング履歴（下部） */}
        <div className="bg-gray-900 rounded-2xl p-4">
          <h2 className="font-bold mb-3 text-gray-200">トレーニング履歴</h2>
          <WorkoutHistory />
        </div>

      </div>
    </div>
  )
}
