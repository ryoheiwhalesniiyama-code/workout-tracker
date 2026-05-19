'use client'

import { useState, useRef, useEffect } from 'react'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

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

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'エラーが発生しました。もう一度試してください。' }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white">
      <div className="flex items-center px-4 py-3 border-b border-gray-800 bg-gray-900">
        <a href="/" className="text-gray-400 mr-3 text-xl">←</a>
        <div>
          <h1 className="font-bold text-lg">AIコーチ</h1>
          <p className="text-xs text-gray-500">過去のログを全て把握しています</p>
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
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-100'
              }`}>
                {msg.content}
              </div>
            </div>
          ))
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

      <div className="px-4 py-3 border-t border-gray-800 bg-gray-900">
        <div className="flex gap-2 items-end">
          <textarea
            className="flex-1 bg-gray-800 rounded-2xl px-4 py-3 text-sm resize-none outline-none focus:ring-1 focus:ring-blue-500 max-h-32"
            placeholder="メッセージを入力..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0 transition-colors"
          >
            ↑
          </button>
        </div>
        <p className="text-xs text-gray-600 mt-1 text-center">Enterで送信 / Shift+Enterで改行</p>
      </div>
    </div>
  )
}
