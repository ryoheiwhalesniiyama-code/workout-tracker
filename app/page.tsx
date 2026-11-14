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
    <div className="min-h-screen bg-background text-foreground">
      {/* ヘッダー */}
      <div className="px-4 py-4 border-b border-stone-200 bg-surface">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <img src="/icon.png" alt="icon" className="w-8 h-8 rounded-lg" />
          Workout Tracker
        </h1>
        <p className="text-stone-600 text-sm mt-0.5">目標: Big3 370kg total</p>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">

        {/* アクションボタン（上部） */}
        <div className="grid grid-cols-3 gap-3">
          <Link href="/log" className="bg-accent hover:bg-accent-hover active:bg-accent-pressed rounded-2xl p-4 text-center transition-colors text-white">
            <p className="text-3xl mb-1">📷</p>
            <p className="font-bold text-sm">ログを記録</p>
            <p className="text-xs text-white mt-0.5">スクショ</p>
          </Link>
          <Link href="/plan" className="bg-field hover:bg-stone-200 active:bg-stone-300 rounded-2xl p-4 text-center transition-colors">
            <p className="text-3xl mb-1">📋</p>
            <p className="font-bold text-sm">次回メニュー</p>
            <p className="text-xs text-stone-600 mt-0.5">AIコーチ提案</p>
          </Link>
          <Link href="/chat" className="bg-field hover:bg-stone-200 active:bg-stone-300 rounded-2xl p-4 text-center transition-colors">
            <p className="text-3xl mb-1">🤖</p>
            <p className="font-bold text-sm">AIコーチ</p>
            <p className="text-xs text-stone-600 mt-0.5">レビュー・相談</p>
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Link href="/progress" className="block bg-field hover:bg-stone-200 active:bg-stone-300 rounded-2xl p-4 text-center transition-colors">
            <p className="text-2xl mb-1">📈</p>
            <p className="font-bold text-sm">Big3</p>
            <p className="text-xs text-stone-600 mt-0.5">重量推移</p>
          </Link>
          <Link href="/body-metrics" className="block bg-field hover:bg-stone-200 active:bg-stone-300 rounded-2xl p-4 text-center transition-colors">
            <p className="text-2xl mb-1">⚖️</p>
            <p className="font-bold text-sm">体組成</p>
            <p className="text-xs text-stone-600 mt-0.5">体重・筋肉量</p>
          </Link>
          <Link href="/import" className="block bg-field hover:bg-stone-200 active:bg-stone-300 rounded-2xl p-4 text-center transition-colors">
            <p className="text-2xl mb-1">📦</p>
            <p className="font-bold text-sm">インポート</p>
            <p className="text-xs text-stone-600 mt-0.5">一括取り込み</p>
          </Link>
        </div>

        {/* Big3 進捗（中部） */}
        <div className="bg-surface rounded-2xl p-4">
          <h2 className="font-bold mb-3 text-stone-800">Big3 現在値</h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { name: 'ベンチ', current: benchPR, target: 110 },
              { name: 'スクワット', current: squatPR, target: 120 },
              { name: 'デッドリフト', current: deadliftPR, target: 140 },
            ].map(({ name, current, target }) => (
              <div key={name} className="bg-field rounded-xl p-3 text-center">
                <p className="text-xs text-stone-600 mb-1">{name}</p>
                <p className="text-xl font-bold text-foreground">{current}</p>
                <p className="text-xs text-stone-600">目標 {target}kg</p>
                <div className="mt-2 bg-stone-200 rounded-full h-1.5">
                  <div
                    className="bg-accent-hover h-1.5 rounded-full"
                    style={{ width: `${Math.min((current / target) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="bg-field rounded-xl p-3 flex justify-between items-center">
            <span className="text-stone-600 text-sm">トータル</span>
            <div className="text-right">
              <span className="text-2xl font-bold text-accent">{total}kg</span>
              <span className="text-stone-600 text-sm ml-2">/ 370kg</span>
            </div>
          </div>
        </div>

        {/* 体組成 */}
        {latestMetric && (
          <Link href="/body-metrics" className="block bg-surface rounded-2xl p-4 hover:bg-field transition-colors">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-stone-800">最新の体組成</h2>
              <span className="text-xs text-stone-600">推移グラフ →</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '体重', value: latestMetric.body_weight, unit: 'kg' },
                { label: '筋肉量', value: latestMetric.muscle_mass, unit: 'kg' },
                { label: '体脂肪率', value: latestMetric.body_fat_percent, unit: '%' },
              ].map(({ label, value, unit }) => (
                <div key={label} className="bg-field rounded-xl p-3 text-center">
                  <p className="text-xs text-stone-600">{label}</p>
                  <p className="text-lg font-bold mt-1">{value ?? '-'}<span className="text-xs text-stone-600">{unit}</span></p>
                </div>
              ))}
            </div>
          </Link>
        )}

        {/* トレーニング履歴（下部） */}
        <div className="bg-surface rounded-2xl p-4">
          <h2 className="font-bold mb-3 text-stone-800">トレーニング履歴</h2>
          <WorkoutHistory />
        </div>

      </div>
    </div>
  )
}
