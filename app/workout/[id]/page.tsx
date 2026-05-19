import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function WorkoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [{ data: log }, { data: sets }] = await Promise.all([
    supabaseAdmin.from('workout_logs').select('*').eq('id', id).single(),
    supabaseAdmin.from('workout_sets').select('*').eq('workout_log_id', id).order('set_number', { ascending: true })
  ])

  if (!log) notFound()

  // 種目ごとにセットをグループ化
  const exerciseMap: Record<string, typeof sets> = {}
  for (const set of sets ?? []) {
    if (!exerciseMap[set.exercise_name]) exerciseMap[set.exercise_name] = []
    exerciseMap[set.exercise_name]!.push(set)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="flex items-center px-4 py-3 border-b border-gray-800 bg-gray-900">
        <Link href="/" className="text-gray-400 mr-3 text-xl">←</Link>
        <div>
          <h1 className="font-bold text-lg">{log.date}</h1>
          <p className="text-xs text-gray-500">トレーニング詳細</p>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-4">
        {/* コンディション */}
        <div className="bg-gray-900 rounded-2xl p-4">
          <h2 className="font-bold mb-3 text-gray-200">コンディション</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: '体重', value: log.body_weight, unit: 'kg' },
              { label: '睡眠', value: log.sleep_hours, unit: 'h' },
              { label: '疲労度', value: log.fatigue_level, unit: '/10' },
              { label: 'モチベ', value: log.motivation, unit: '/10' },
            ].map(({ label, value, unit }) => (
              <div key={label} className="bg-gray-800 rounded-xl px-4 py-3 flex justify-between items-center">
                <span className="text-sm text-gray-400">{label}</span>
                <span className="font-bold">{value ?? '-'}<span className="text-xs text-gray-500 ml-0.5">{unit}</span></span>
              </div>
            ))}
          </div>
          {log.notes && (
            <div className="mt-3 bg-gray-800 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-500 mb-1">メモ</p>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{log.notes}</p>
            </div>
          )}
        </div>

        {/* 種目別セット */}
        {Object.keys(exerciseMap).length > 0 && (
          <div className="bg-gray-900 rounded-2xl p-4">
            <h2 className="font-bold mb-3 text-gray-200">トレーニング内容</h2>
            <div className="space-y-4">
              {Object.entries(exerciseMap).map(([exercise, exSets]) => (
                <div key={exercise}>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="font-medium text-sm">{exercise}</p>
                    {exSets![0].is_main_lift && (
                      <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded-full">メイン</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {exSets!.map((set, i) => (
                      <div key={i} className="bg-gray-800 rounded-lg px-4 py-2 flex justify-between items-center">
                        <span className="text-xs text-gray-500">Set {set.set_number}</span>
                        <span className="text-sm font-medium">{set.weight}kg × {set.reps}reps</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AIコーチへのリンク */}
        <Link
          href={`/chat?date=${log.date}`}
          className="block w-full bg-blue-600 hover:bg-blue-500 rounded-xl py-4 text-center font-bold transition-colors"
        >
          🤖 このトレーニングをAIにレビューしてもらう
        </Link>
      </div>
    </div>
  )
}
