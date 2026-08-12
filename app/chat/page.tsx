'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

type Message = {
  role: 'user' | 'assistant'
  content: string
  session_id?: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 今日の日付をセッションIDとして使用（同日は会話を継続、翌日はリセット）
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

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    // 高さを内容に合わせて自動調整
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    // 送信後に高さをリセット
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    setMessages(prev => [...prev, { role: 'user', content: userMessage, session_id: sessionId }])
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, session_id: sessionId })
      })
      const data = await res.json()
      if (data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ エラー: ${data.error}`, session_id: sessionId }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.message, session_id: sessionId }])
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ 通信エラー: ${msg}`, session_id: sessionId }])
    } finally {
      setLoading(false)
    }
  }

  const handleFocus = useCallback(() => {
    // キーボードが出た後にスクロールして入力欄を見えるようにする
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 300)
  }, [])

  // 日付ヘッダーを挿入しながらメッセージをレンダリング
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
            msg.role === 'user'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-100'
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
      <div className="sticky top-0 z-10 flex items-center px-4 py-3 border-b border-gray-800 bg-gray-900 flex-shrink-0">
        <a href="/" className="text-gray-400 mr-3 text-xl">←</a>
        <div>
          <h1 className="font-bold text-lg">AIコーチ</h1>
          <p className="text-xs text-gray-500">過去7日間の会話を表示中</p>
        </div>
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
            <div className="bg-gray-800 rounded-2xl px-4 py-3 text-sm text-gray-400">
              考え中...
            </div>
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
