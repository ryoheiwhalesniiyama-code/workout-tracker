'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export default function LogPage() {
  const router = useRouter()
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  // ワークアウトスクショ
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  // 体組成スクショ（オプション）① 体脂肪 ② 筋肉
  const [bodyFile1, setBodyFile1] = useState<File | null>(null)
  const [bodyPreview1, setBodyPreview1] = useState<string | null>(null)
  const [isBodyDragOver1, setIsBodyDragOver1] = useState(false)
  const [bodyFile2, setBodyFile2] = useState<File | null>(null)
  const [bodyPreview2, setBodyPreview2] = useState<string | null>(null)
  const [isBodyDragOver2, setIsBodyDragOver2] = useState(false)

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const [sleepHours, setSleepHours] = useState('')
  const [fatigueLevel, setFatigueLevel] = useState('')
  const [motivation, setMotivation] = useState('')
  const [bodyWeight, setBodyWeight] = useState('')
  const [notes, setNotes] = useState('')

  const setImageFile = (f: File) => {
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setResult(null)
    setError('')
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setImageFile(f)
  }

  const handleBodyFile1Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) { setBodyFile1(f); setBodyPreview1(URL.createObjectURL(f)) }
  }

  const handleBodyFile2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) { setBodyFile2(f); setBodyPreview2(URL.createObjectURL(f)) }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f && f.type.startsWith('image/')) setImageFile(f)
  }, [])

  const handleBodyDrop1 = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsBodyDragOver1(false)
    const f = e.dataTransfer.files?.[0]
    if (f && f.type.startsWith('image/')) { setBodyFile1(f); setBodyPreview1(URL.createObjectURL(f)) }
  }, [])

  const handleBodyDrop2 = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsBodyDragOver2(false)
    const f = e.dataTransfer.files?.[0]
    if (f && f.type.startsWith('image/')) { setBodyFile2(f); setBodyPreview2(URL.createObjectURL(f)) }
  }, [])

  const handleUpload = async () => {
    if (!file || !date) return
    setLoading(true)
    setError('')

    try {
      // ワークアウトログ保存
      const formData = new FormData()
      formData.append('file', file)
      formData.append('date', date)
      if (notes) formData.append('notes', notes)

      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()

      if (data.error) {
        setError(data.error)
        return
      }

      // コンディション追加保存
      if (sleepHours || fatigueLevel || motivation || bodyWeight || notes) {
        await fetch('/api/workout-detail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            logId: data.logId,
            sleepHours: sleepHours ? Number(sleepHours) : null,
            fatigueLevel: fatigueLevel ? Number(fatigueLevel) : null,
            motivation: motivation ? Number(motivation) : null,
            bodyWeight: bodyWeight ? Number(bodyWeight) : null,
            notes
          })
        })
      }

      // 体組成スクショがあれば保存（① 体脂肪 + ② 筋肉）
      if (bodyFile1 || bodyFile2) {
        const bodyFormData = new FormData()
        if (bodyFile1) bodyFormData.append('file1', bodyFile1)
        if (bodyFile2) bodyFormData.append('file2', bodyFile2)
        bodyFormData.append('date', date)
        const bodyRes = await fetch('/api/body-composition', { method: 'POST', body: bodyFormData })
        const bodyData = await bodyRes.json()
        if (bodyData.error) {
          console.error('体組成保存エラー:', bodyData.error)
          // ワークアウト自体は保存済みなので致命的エラーにはしない
        }
      }

      setResult(data.data)
    } catch {
      setError('アップロードに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="flex items-center px-4 py-3 border-b border-gray-800 bg-gray-900">
        <a href="/" className="text-gray-400 mr-3 text-xl">←</a>
        <h1 className="font-bold text-lg">ログを記録</h1>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
        {/* 日付 */}
        <div>
          <label className="text-sm text-gray-400 block mb-1">トレーニング日</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full bg-gray-800 rounded-xl px-4 py-3 text-white outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* 筋トレMEMO */}
        <div>
          <label className="text-xs text-gray-400 block mb-1">筋トレMEMO</label>
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            className={`border-2 border-dashed rounded-xl transition-colors ${
              isDragOver ? 'border-blue-400 bg-blue-950/30' : 'border-gray-700'
            }`}
          >
            <label className="block p-4 text-center cursor-pointer min-h-[100px] flex items-center justify-center">
              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              {preview ? (
                <img src={preview} alt="preview" className="max-h-32 rounded-lg" />
              ) : (
                <div className="text-gray-500">
                  <p className="text-2xl mb-1">📷</p>
                  <p className="text-xs">タップ / ドロップ</p>
                </div>
              )}
            </label>
          </div>
        </div>

        {/* 体組成（任意）① 体脂肪 ② 筋肉 */}
        <div>
          <label className="text-xs text-gray-400 block mb-1">
            体組成（任意）
            <span className="text-gray-600 ml-1">— タニタ①体脂肪 + ②筋肉の2枚</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {/* ① 体脂肪画面 */}
            <div
              onDrop={handleBodyDrop1}
              onDragOver={e => { e.preventDefault(); setIsBodyDragOver1(true) }}
              onDragLeave={() => setIsBodyDragOver1(false)}
              className={`border-2 border-dashed rounded-xl transition-colors ${
                isBodyDragOver1 ? 'border-green-400 bg-green-950/30' : 'border-gray-700'
              }`}
            >
              <label className="block p-3 text-center cursor-pointer min-h-[90px] flex flex-col items-center justify-center">
                <input type="file" accept="image/*" onChange={handleBodyFile1Change} className="hidden" />
                {bodyPreview1 ? (
                  <img src={bodyPreview1} alt="体脂肪" className="max-h-24 rounded-lg" />
                ) : (
                  <div className="text-gray-500">
                    <p className="text-xl mb-1">①</p>
                    <p className="text-xs font-medium text-gray-400">体脂肪</p>
                    <p className="text-xs text-gray-600 mt-0.5">体重・脂肪率</p>
                  </div>
                )}
              </label>
            </div>

            {/* ② 筋肉画面 */}
            <div
              onDrop={handleBodyDrop2}
              onDragOver={e => { e.preventDefault(); setIsBodyDragOver2(true) }}
              onDragLeave={() => setIsBodyDragOver2(false)}
              className={`border-2 border-dashed rounded-xl transition-colors ${
                isBodyDragOver2 ? 'border-green-400 bg-green-950/30' : 'border-gray-700'
              }`}
            >
              <label className="block p-3 text-center cursor-pointer min-h-[90px] flex flex-col items-center justify-center">
                <input type="file" accept="image/*" onChange={handleBodyFile2Change} className="hidden" />
                {bodyPreview2 ? (
                  <img src={bodyPreview2} alt="筋肉" className="max-h-24 rounded-lg" />
                ) : (
                  <div className="text-gray-500">
                    <p className="text-xl mb-1">②</p>
                    <p className="text-xs font-medium text-gray-400">筋肉</p>
                    <p className="text-xs text-gray-600 mt-0.5">筋肉量(kg)</p>
                  </div>
                )}
              </label>
            </div>
          </div>
        </div>

        {/* コンディション */}
        <div className="bg-gray-900 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-gray-300">コンディション（任意）</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">睡眠時間</label>
              <input type="number" placeholder="8" value={sleepHours} onChange={e => setSleepHours(e.target.value)}
                className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none mt-1" />
            </div>
            <div>
              <label className="text-xs text-gray-500">体重 (kg)</label>
              <input type="number" placeholder="75.0" value={bodyWeight} onChange={e => setBodyWeight(e.target.value)}
                className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none mt-1" />
            </div>
            <div>
              <label className="text-xs text-gray-500">疲労度 (1-10)</label>
              <input type="number" min="1" max="10" placeholder="5" value={fatigueLevel} onChange={e => setFatigueLevel(e.target.value)}
                className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none mt-1" />
            </div>
            <div>
              <label className="text-xs text-gray-500">モチベ (1-10)</label>
              <input type="number" min="1" max="10" placeholder="8" value={motivation} onChange={e => setMotivation(e.target.value)}
                className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">メモ（AIコーチが参考にします）</label>
            <textarea
              placeholder="エルボースリーブを初使用。ライイングエクステンションの感触が良かった..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none mt-1 resize-none"
              rows={4}
            />
          </div>
        </div>

        {/* エラー */}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {/* 抽出結果 */}
        {result && (
          <div className="bg-green-900/30 border border-green-700 rounded-xl p-4">
            <p className="text-green-400 font-medium mb-2">✅ 保存しました！</p>
            {result.exercises?.map((ex: any, i: number) => (
              <div key={i} className="text-sm text-gray-300 mb-1">
                <span className="font-medium">{ex.name}</span>: {ex.sets?.length}セット
              </div>
            ))}
            {(bodyFile1 || bodyFile2) && (
              <p className="text-xs text-green-300 mt-1">
                ⚖️ 体組成データも保存しました（{[bodyFile1 && '①体脂肪', bodyFile2 && '②筋肉'].filter(Boolean).join(' + ')}）
              </p>
            )}
            <div className="flex gap-2 mt-3">
              <button onClick={() => router.push('/chat')}
                className="flex-1 bg-blue-600 hover:bg-blue-500 rounded-lg py-2 text-sm font-medium transition-colors">
                AIにレビューしてもらう
              </button>
              <button onClick={() => router.push('/')}
                className="flex-1 bg-gray-700 hover:bg-gray-600 rounded-lg py-2 text-sm font-medium transition-colors">
                ホームへ
              </button>
            </div>
          </div>
        )}

        {/* 保存ボタン */}
        {!result && (
          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl py-4 font-bold transition-colors"
          >
            {loading ? '解析中...' : '保存する'}
          </button>
        )}
      </div>
    </div>
  )
}
