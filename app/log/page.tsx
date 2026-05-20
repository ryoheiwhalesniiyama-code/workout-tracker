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

  // 体組成スクショ（オプション）
  const [bodyFile, setBodyFile] = useState<File | null>(null)
  const [bodyPreview, setBodyPreview] = useState<string | null>(null)
  const [isBodyDragOver, setIsBodyDragOver] = useState(false)

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

  const setBodyImageFile = (f: File) => {
    setBodyFile(f)
    setBodyPreview(URL.createObjectURL(f))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setImageFile(f)
  }

  const handleBodyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setBodyImageFile(f)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f && f.type.startsWith('image/')) setImageFile(f)
  }, [])

  const handleBodyDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsBodyDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f && f.type.startsWith('image/')) setBodyImageFile(f)
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

      // 体組成スクショがあれば保存
      if (bodyFile) {
        const bodyFormData = new FormData()
        bodyFormData.append('file', bodyFile)
        bodyFormData.append('date', date)
        await fetch('/api/body-composition', { method: 'POST', body: bodyFormData })
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

        {/* スクショ2列 */}
        <div className="grid grid-cols-2 gap-3">
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

          {/* 体組成（オプション） */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">体組成（任意）</label>
            <div
              onDrop={handleBodyDrop}
              onDragOver={e => { e.preventDefault(); setIsBodyDragOver(true) }}
              onDragLeave={() => setIsBodyDragOver(false)}
              className={`border-2 border-dashed rounded-xl transition-colors ${
                isBodyDragOver ? 'border-green-400 bg-green-950/30' : 'border-gray-700'
              }`}
            >
              <label className="block p-4 text-center cursor-pointer min-h-[100px] flex items-center justify-center">
                <input type="file" accept="image/*" onChange={handleBodyFileChange} className="hidden" />
                {bodyPreview ? (
                  <img src={bodyPreview} alt="body preview" className="max-h-32 rounded-lg" />
                ) : (
                  <div className="text-gray-500">
                    <p className="text-2xl mb-1">⚖️</p>
                    <p className="text-xs">タニタ等の画面</p>
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
            {bodyFile && <p className="text-xs text-green-300 mt-1">⚖️ 体組成データも保存しました</p>}
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
