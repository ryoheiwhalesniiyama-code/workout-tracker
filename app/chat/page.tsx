'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { parseSaveMenuMarker } from '@/lib/saveMenuParser'

type Message = {
  role: 'user' | 'assistant'
  content: string
  session_id?: string
}

type Toast = { message: string; type: 'success' | 'error' }

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [toast, setToast] = useState<Toast | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const sessionId = new Date().toISOString().split('T')[0]

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await fetch('/api/chat-history')
        const data = await res.json()
        if (data.messages) setMessages(data.messages)
      } finally {
        setInitialLoading(false)
      }
    }
    loadHistory()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const showToast = useCallback((message: string, type: Toast['type']) => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const saveNextMenu = useCallback(async (content: string, plannedDate: string) => {
    try {
      const res = await fetch('/api/next-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, planned_date: plannedDate })
      })
      if (res.ok) {
        showToast('次回メニューを保存しました ✅', 'success')
      } else {
        showToast('保存に失敗しました', 'error')
      }
    } catch {
      showToast('保存に失敗しました', 'error')
    }
  }, [showToast])

  const sendMessageWithContent = useCallback(async (text: string) => {
    if (loading || !text.trim()) return

    setMessages(prev => [...prev, { role: 'user', content: text, session_id: sessionId }])
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session_id: sessionId })
      })
      const data = await res.json()

      if (data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ エラー: ${data.error}`, session_id: sessionId }])
        return
      }

      const rawMessage: string = data.message ?? ''

      // SAVE_MENUマーカーを検出
      const saveResult = parseSaveMenuMarker(rawMessage)
      if (saveResult) {
        setMessages(prev => [...prev, { role: 'assistant', content: saveResult.cleanContent, session_id: sessionId }])
        await saveNextMenu(saveResult.cleanContent, saveResult.plannedDate)
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: rawMessage, session_id: sessionId }])
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ 通信エラー: ${msg}`, session_id: sessionId }])
    } finally {
      setLoading(false)
    }
  }, [loading, sessionId, saveNextMenu])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    await sendMessageWithContent(text)
  }, [input, sendMessageWithContent])

  const handleExport = useCallback(() => {
    if (loading) return
    sendMessageWithContent('次回メニューを書き出したい')
  }, [loading, sendMessageWithContent])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
  }

  const handleFocus = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 300)
  }, [])

  const renderMessages = () => {
    const elements: React.ReactNode[] = []
    let lastDate = ''

    messages.forEach((msg, i) => {
      const msgDate = msg.session_id ?? ''
      if (msgDate && msgDate !== lastDate) {
        const isToday = msgDate === sessionId
        const label = isToday
          ? '今日'
          : new Date(msgDate + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })
        elements.push(
          <div key={`date-${msgDate}`} className="flex items-center gap-2 my-2">
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-xs text-gray-500">{label}</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>
        )
        lastDate = msgDate
      }
      elements.push(
        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
            msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-100'
          }`}>
            {msg.content}
          </div>
        </div>
      )
    })
    return elements
  }

  return (
    <div className="flex flex-col bg-gray-950 text-white" style={{ height: '100dvh' }}>
      {/* トースト */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-medium shadow-lg transition-all ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* ヘッダー */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900 flex-shrink-0">
        <div className="flex items-center">
          <a href="/" className="text-gray-400 mr-3 text-xl">←</a>
          <div>
            <h1 className="font-bold text-lg">AIコーチ</h1>
            <p className="text-xs text-gray-500">過去7日間の会話を表示中</p>
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={loading}
          title="次回メニューを書き出す"
          className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded-xl px-3 py-2 text-xs font-medium transition-colors"
        >
          📋 書き出す
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {initialLoading ? (
          <div className="text-center text-gray-500 mt-20">
            <p className="text-sm">履歴を読み込み中...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-20">
            <p className="text-4xl mb-4">🏋️</p>
            <p>トレーニングについて何でも聞いてください</p>
            <p className="text-sm mt-2">過去のログを全て把握しています</p>
          </div>
        ) : (
          renderMessages()
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-2xl px-4 py-3 text-sm text-gray-400">考え中...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t border-gray-800 bg-gray-900 flex-shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            className="flex-1 bg-gray-800 rounded-2xl px-4 py-3 text-sm resize-none outline-none focus:ring-1 focus:ring-blue-500 max-h-40 overflow-y-auto"
            placeholder="メッセージを入力..."
            value={input}
            onChange={handleInputChange}
            onFocus={handleFocus}
            rows={1}
            style={{ height: 'auto' }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0 transition-colors"
          >
            ↑
          </button>
        </div>
        <p className="text-xs text-gray-600 mt-1 text-center">右の↑ボタンで送信</p>
      </div>
    </div>
  )
}
