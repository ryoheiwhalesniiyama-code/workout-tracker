'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'

type FileStatus = {
  file: File
  status: 'pending' | 'processing' | 'done' | 'error'
  date?: string
  exercises?: string[]
  error?: string
}

export default function ImportPage() {
  const [files, setFiles] = useState<FileStatus[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [importing, setImporting] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  const addFiles = (newFiles: File[]) => {
    const imageFiles = newFiles.filter(f => f.type.startsWith('image/'))
    setFiles(prev => [
      ...prev,
      ...imageFiles.map(f => ({ file: f, status: 'pending' as const }))
    ])
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files))
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files) addFiles(Array.from(e.dataTransfer.files))
  }, [])

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const startImport = async () => {
    if (files.length === 0 || importing) return
    setImporting(true)
    setCurrentIndex(0)

    const updated = [...files]

    for (let i = 0; i < updated.length; i++) {
      if (updated[i].status === 'done') continue

      setCurrentIndex(i)
      updated[i] = { ...updated[i], status: 'processing' }
      setFiles([...updated])

      try {
        const formData = new FormData()
        formData.append('file', updated[i].file)

        const res = await fetch('/api/bulk-import', { method: 'POST', body: formData })
        const data = await res.json()

        if (data.error) {
          updated[i] = { ...updated[i], status: 'error', error: data.error }
        } else {
          updated[i] = {
            ...updated[i],
            status: 'done',
            date: data.date,
            exercises: data.exercises
          }
        }
      } catch {
        updated[i] = { ...updated[i], status: 'error', error: '通信エラー' }
      }

      setFiles([...updated])

      // APIレート制限対策（1秒待機）
      if (i < updated.length - 1) {
        await new Promise(r => setTimeout(r, 1000))
      }
    }

    setImporting(false)
  }

  const doneCount = files.filter(f => f.status === 'done').length
  const errorCount = files.filter(f => f.status === 'error').length
  const pendingCount = files.filter(f => f.status === 'pending').length

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex items-center px-4 py-3 border-b border-stone-200 bg-surface">
        <Link href="/" className="text-stone-600 mr-3 text-xl">←</Link>
        <div>
          <h1 className="font-bold text-lg">一括インポート</h1>
          <p className="text-xs text-stone-600">筋トレMEMOのスクショを複数まとめて取り込む</p>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">

        {/* アップロードエリア */}
        {!importing && (
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            className={`border-2 border-dashed rounded-2xl transition-colors ${
              isDragOver ? 'border-accent bg-accent-soft' : 'border-stone-400'
            }`}
          >
            <label className="block p-8 text-center cursor-pointer">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <p className="text-4xl mb-3">📂</p>
              <p className="font-medium">タップして複数選択 / ドラッグ&ドロップ</p>
              <p className="text-sm text-stone-600 mt-1">画像から日付を自動読み取りします</p>
            </label>
          </div>
        )}

        {/* ファイル数サマリー */}
        {files.length > 0 && (
          <div className="bg-surface rounded-2xl p-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-stone-800">
                選択中: {files.length}枚
              </h2>
              {importing && (
                <span className="text-sm text-accent">
                  処理中 {doneCount + errorCount}/{files.length}
                </span>
              )}
            </div>

            {/* プログレスバー */}
            {importing && (
              <div className="mb-4">
                <div className="bg-stone-200 rounded-full h-2">
                  <div
                    className="bg-accent-hover h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((doneCount + errorCount) / files.length) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-stone-600 mt-1">
                  <span>✅ 成功: {doneCount}</span>
                  {errorCount > 0 && <span>❌ エラー: {errorCount}</span>}
                  <span>⏳ 残り: {pendingCount + (importing ? 1 : 0)}</span>
                </div>
              </div>
            )}

            {/* ファイルリスト */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {files.map((f, i) => (
                <div key={i} className={`rounded-xl px-4 py-3 flex items-center gap-3 ${
                  f.status === 'done' ? 'bg-accent-soft border border-accent-line' :
                  f.status === 'error' ? 'bg-red-50 border border-red-300' :
                  f.status === 'processing' ? 'bg-field border border-accent-line' :
                  'bg-field'
                }`}>
                  <span className="text-lg flex-shrink-0">
                    {f.status === 'done' ? '✅' :
                     f.status === 'error' ? '❌' :
                     f.status === 'processing' ? '⏳' : '📷'}
                  </span>
                  <div className="flex-1 min-w-0">
                    {f.status === 'done' ? (
                      <>
                        <p className="text-sm font-medium">{f.date}</p>
                        <p className="text-xs text-stone-600 truncate">{f.exercises?.join(' · ')}</p>
                      </>
                    ) : f.status === 'error' ? (
                      <>
                        <p className="text-sm text-red-800">{f.error}</p>
                        <p className="text-xs text-stone-600 truncate">{f.file.name}</p>
                      </>
                    ) : f.status === 'processing' ? (
                      <p className="text-sm text-accent">解析中...</p>
                    ) : (
                      <p className="text-sm text-stone-600 truncate">{f.file.name}</p>
                    )}
                  </div>
                  {f.status === 'pending' && !importing && (
                    <button
                      onClick={() => removeFile(i)}
                      className="text-stone-700 hover:text-stone-600 text-sm flex-shrink-0"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 完了メッセージ */}
        {!importing && doneCount > 0 && pendingCount === 0 && (
          <div className="bg-accent-soft border border-accent-line rounded-2xl p-4 text-center">
            <p className="text-accent font-bold text-lg">🎉 インポート完了！</p>
            <p className="text-stone-800 text-sm mt-1">
              {doneCount}件成功{errorCount > 0 ? ` / ${errorCount}件エラー` : ''}
            </p>
            <Link
              href="/"
              className="block mt-3 bg-accent hover:bg-accent-hover rounded-xl py-3 font-bold text-sm transition-colors text-white"
            >
              ホームで確認する
            </Link>
          </div>
        )}

        {/* インポートボタン */}
        {files.length > 0 && !importing && pendingCount > 0 && (
          <button
            onClick={startImport}
            className="w-full bg-accent hover:bg-accent-hover rounded-2xl py-4 font-bold text-lg transition-colors text-white"
          >
            {files.length}枚をインポート開始
          </button>
        )}

        {/* 注意書き */}
        {files.length === 0 && (
          <div className="bg-surface rounded-2xl p-4 text-sm text-stone-600 space-y-2">
            <p className="font-medium text-stone-800">使い方</p>
            <p>1. 筋トレMEMOのスクショを全て選択</p>
            <p>2. 「インポート開始」をタップ</p>
            <p>3. 1枚ずつ自動で処理されます（60枚で約2〜3分）</p>
            <p className="text-xs text-stone-700 pt-1">※ 同じ日付のデータは上書きされます</p>
          </div>
        )}

      </div>
    </div>
  )
}
