import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ create: vi.fn(), history: vi.fn(), context: vi.fn(), insert: vi.fn() }))
vi.mock('@anthropic-ai/sdk', () => ({ default: class { messages = { create: mocks.create } } }))
vi.mock('@/lib/coachContext', () => ({ loadCoachHistory: mocks.history, loadCoachContext: mocks.context }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: vi.fn(() => ({ insert: mocks.insert })) } }))
import { POST } from '@/app/api/chat/route'
import { GET } from '@/app/api/chat-history/route'

const request = (body: unknown) => new NextRequest('http://localhost/api/chat', { method: 'POST', body: JSON.stringify(body) })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.context.mockResolvedValue({ workoutLogs: [], bodyMetrics: [], fatigueNotes: [], plannedMenus: [], reviews: [] })
  mocks.history.mockResolvedValue([
    { role: 'user', content: '前回はセット数を減らすと決めた', session_id: '2026-10-31' },
    { role: 'assistant', content: '次回は肩の張りを確認しよう', session_id: '2026-10-31' },
  ])
  mocks.create.mockResolvedValue({ model: 'claude-sonnet-4-5', stop_reason: 'tool_use', usage: {}, content: [
    { type: 'tool_use', name: 'coach_reply', input: { message: '前回と比べて肩の張りはどうだった？' } },
  ] })
  mocks.insert.mockResolvedValue({ error: null })
})

describe('日をまたぐコーチングと保存失敗', () => {
  it('日付で履歴を捨てず、前回の合意と確認事項をAPIへ送る', async () => {
    const res = await POST(request({ message: '昨日の結果を相談したい', session_id: '偽の日付' }))
    expect(res.status).toBe(200)
    expect(mocks.create.mock.calls[0][0].messages[0].content).toContain('セット数を減らす')
    expect(mocks.create.mock.calls[0][0].messages[1].content).toContain('肩の張り')
    const rows = mocks.insert.mock.calls[0][0]
    expect(rows[0].session_id).not.toBe('偽の日付')
    expect(rows[0].created_at < rows[1].created_at).toBe(true)
  })
  it('履歴取得に失敗したとき、記憶なしで回答を生成しない', async () => {
    mocks.history.mockRejectedValue(new Error('履歴を取得できません'))
    expect((await POST(request({ message: '続き' }))).status).toBe(500)
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('保存失敗を成功として画面へ返さない', async () => {
    mocks.insert.mockResolvedValue({ error: { message: 'DB unavailable' } })
    const res = await POST(request({ message: '結果報告' }))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toContain('保存できません')
  })
  it('上限で切れた返答を会話履歴へ保存しない', async () => {
    mocks.create.mockResolvedValue({ model: 'claude-sonnet-4-5', stop_reason: 'max_tokens', usage: {}, content: [] })
    expect((await POST(request({ message: '分析して' }))).status).toBe(502)
    expect(mocks.insert).not.toHaveBeenCalled()
  })
  it('履歴画面もエラー時は空の会話として隠さない', async () => {
    mocks.history.mockRejectedValue(new Error('履歴を取得できません'))
    const res = await GET()
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBeTruthy()
  })
  it('空の入力は外部APIを呼ばず拒否する', async () => {
    expect((await POST(request({ message: '' }))).status).toBe(400)
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
