'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export default function LogPage() {
  const router = useRouter()
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)

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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f && f.type.startsWith('image/')) setImageFile(f)
  }, [])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => setIsDragOver(false)

  const handleUpload = async () => {
    if (!file || !date) return
    setLoading(true)
    setError('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('date', date)
    if (notes) formData.append('notes', notes)

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
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
        setResult(data.data)
      }
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

        {/* スクショアップロード（ドラッグ&ドロップ対応） */}
        <div>
          <label className="text-sm text-gray-400 block mb-1">筋トレMEMOのスクショ</label>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`relative border-2 border-dashed rounded-xl transition-colors ${
              isDragOver ? 'border-blue-400 bg-blue-950/30' : 'border-gray-700'
            }`}
          >
            <label className="block p-6 text-center cursor-pointer">
              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              {preview ? (
                <img src={preview} alt="preview" className="max-h-64 mx-auto rounded-lg" />
              ) : (
                <div className="text-gray-500">
                  <p className="text-3xl mb-2">📷</p>
                  <p className="text-sm">タップして選択 / ドラッグ&ドロップ</p>
                </div>
              )}
            </label>
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

        {/* アップロードボタン */}
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
