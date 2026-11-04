'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { jstDate, formatCoachDate } from '@/lib/coachDates'
import type { PlanDraft, ReviewCard } from '@/lib/coachMemory'
import CoachPlanCard from '@/app/components/CoachPlanCard'

type Message = { id?: string; role: 'user' | 'assistant'; content: string; session_id?: string; draft?: PlanDraft }

function InlineText({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith('**')
    ? <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong> : part)}</>
}
function Answer({ text }: { text: string }) {
  return <div className="space-y-3 break-words [overflow-wrap:anywhere]">
    {text.split(/\n\s*\n/).map((paragraph, i) => <p key={i} className={`whitespace-pre-wrap leading-7 ${i === 0 ? 'text-gray-100' : 'text-gray-200'}`}>
      <InlineText text={paragraph.replace(/^#{1,4}\s/gm, '')} />
    </p>)}
  </div>
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [reviews, setReviews] = useState<ReviewCard[]>([])
  const [savedIds, setSavedIds] = useState<string[]>([])
  const [contextStart, setContextStart] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')
  const [sendError, setSendError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const nearBottom = useRef(true)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const loadHistory = useCallback((signal?: AbortSignal) =>
    fetch('/api/chat-history', { cache: 'no-store', signal }).then(async res => {
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '会話履歴を取得できませんでした')
      return data
    }).then(data => {
      if (signal?.aborted) return
      setMessages(data.messages)
      setReviews(data.reviews ?? [])
      setSavedIds(data.savedPlanIds ?? [])
      setContextStart(data.contextStart)
    }).catch(e => {
      if (!signal?.aborted) setHistoryError(e instanceof Error ? e.message : '履歴を取得できませんでした')
    }).finally(() => { if (!signal?.aborted) setInitialLoading(false) }), [])
  useEffect(() => {
    const controller = new AbortController()
    void loadHistory(controller.signal)
    return () => controller.abort()
  }, [loadHistory])
  useEffect(() => {
    if (nearBottom.current) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessageWithContent = useCallback(async (text: string) => {
    if (loading || initialLoading || historyError || !text.trim()) return
    const sessionId = jstDate()
    const localId = crypto.randomUUID()
    nearBottom.current = true
    setSendError('')
    setMessages(prev => [...prev, { id: localId, role: 'user', content: text, session_id: sessionId }])
    setLoading(true)
    setInput('')
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? '返答を取得できませんでした')
      setMessages(prev => [...prev, { role: 'assistant', content: data.message, draft: data.draft, session_id: data.session_id }])
      setReviews(data.reviews ?? [])
      setContextStart(data.contextStart ?? null)
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== localId))
      setInput(text)
      setSendError(e instanceof Error ? e.message : '通信に失敗しました。再送してください。')
    } finally { setLoading(false) }
  }, [loading, initialLoading, historyError])

  const renderMessages = () => {
    let lastDate = ''
    return messages.map((msg, i) => {
      const date = msg.session_id
      const separator = date && date !== lastDate
      if (date) lastDate = date
      return <div key={msg.id ?? i}>
        {separator && <div className="my-5 flex items-center gap-2 text-xs text-gray-500">
          <div className="h-px flex-1 bg-gray-800" /><span>{date === jstDate() ? '今日' : formatCoachDate(date)}</span><div className="h-px flex-1 bg-gray-800" />
        </div>}
        <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`min-w-0 rounded-2xl px-4 py-3 text-[15px] ${msg.role === 'user'
            ? 'max-w-[85%] whitespace-pre-wrap break-words bg-blue-600 leading-7 text-white'
            : 'w-full bg-gray-900 text-gray-100 md:w-[90%] md:px-5 md:py-4'}`}>
            {msg.role === 'assistant' ? <Answer text={msg.content} /> : msg.content}
            {msg.draft && <CoachPlanCard draft={msg.draft} saved={!!msg.draft.draftId && savedIds.includes(msg.draft.draftId)}
              onSaved={id => { setSavedIds(prev => [...prev, id]); void fetch('/api/chat-history', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(data => { if (data) setReviews(data.reviews ?? []) }).catch(() => {}) }} />}
          </div>
        </div>
      </div>
    })
  }

  return <div className="flex h-dvh min-h-0 flex-col bg-gray-950 text-white">
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-800 bg-gray-900 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3"><Link href="/" aria-label="ホームへ戻る" className="text-xl text-gray-400">←</Link>
        <div><h1 className="text-lg font-bold">AIコーチ</h1>
          <p className="text-xs text-gray-400">{contextStart ? `${contextStart}〜の会話を参照` : '会話と計画を引き継いで相談'}</p>
        </div>
      </div>
      <button onClick={() => void sendMessageWithContent('次回メニューを書き出したい。前回の仮説、試す変更、次に確認する結果も含めて。')}
        disabled={loading || initialLoading || !!historyError}
        className="shrink-0 rounded-xl bg-gray-800 px-3 py-2 text-xs disabled:opacity-40">📋 書き出す</button>
    </header>

    <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 md:px-6"
      onScroll={e => { const el = e.currentTarget; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120 }}>
      <div className="mx-auto max-w-4xl space-y-5">
        {reviews.length > 0 && <details className="rounded-xl border border-gray-800 bg-gray-900 p-3">
          <summary className="cursor-pointer text-sm text-blue-200">引き継いでいる計画・次の確認（{reviews.length}件）</summary>
          <div className="mt-3 space-y-3">{reviews.map(review => <div key={review.id} className="border-t border-gray-800 pt-3 text-sm">
            <Link href="/plan" className="text-blue-200 underline">{review.date ? formatCoachDate(review.date) : '予定日未確認'}</Link>
            <p className="my-1 text-xs text-amber-200">{review.status}</p>
            <p className="whitespace-pre-wrap break-words leading-6 text-gray-300">{review.notes}</p>
            {review.logIds.map(id => <Link key={id} href={`/workout/${id}`} className="mr-3 mt-1 inline-block text-xs text-blue-300 underline">照合候補のログ</Link>)}
          </div>)}</div>
        </details>}
        {initialLoading ? <p className="py-12 text-center text-gray-400">履歴と計画を読み込み中…</p>
          : historyError ? <div role="alert" className="rounded-xl bg-red-950 p-4 text-sm"><p>{historyError}</p>
            <button onClick={() => { setInitialLoading(true); setHistoryError(''); void loadHistory() }} className="mt-3 underline">再読み込み</button></div>
          : messages.length === 0 ? <div className="py-12 text-center text-gray-400"><p className="mb-4 text-4xl">🏋️</p>
            <p>トレーニングについて相談してください</p><p className="mt-2 text-sm">保存した計画と実績を比べ、次の一歩を考えます</p></div> : renderMessages()}
        {loading && <p role="status" className="text-sm text-gray-400">前回の計画と記録を確認中…</p>}
        <div ref={bottomRef} />
      </div>
    </main>

    <form className="shrink-0 border-t border-gray-800 bg-gray-900 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      onSubmit={e => { e.preventDefault(); void sendMessageWithContent(input.trim()) }}>
      {sendError && <p role="alert" className="mx-auto mb-2 max-w-4xl text-sm text-red-300">{sendError}</p>}
      <div className="mx-auto flex max-w-4xl items-end gap-2">
        <textarea ref={textareaRef} aria-label="メッセージ" value={input} rows={2} maxLength={10000}
          onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px` }}
          className="max-h-40 min-h-12 flex-1 resize-none rounded-xl bg-gray-800 px-4 py-3 text-base leading-6 outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="今回の結果や、相談したいこと…" />
        <button type="submit" aria-label="送信" disabled={loading || initialLoading || !!historyError || !input.trim()}
          className="h-11 w-11 shrink-0 rounded-full bg-blue-600 text-xl disabled:bg-gray-700">↑</button>
      </div>
      <p className="mt-1 text-center text-xs text-gray-500">右の↑で送信 · 詳しい回答はスクロールして読めます</p>
    </form>
  </div>
}
