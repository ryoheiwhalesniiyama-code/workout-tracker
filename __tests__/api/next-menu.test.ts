import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Supabase モック
const mockSingle = vi.hoisted(() => vi.fn())
const mockInsert = vi.hoisted(() => vi.fn(() => ({ select: vi.fn(() => ({ single: mockSingle })) })))
const mockOrder = vi.hoisted(() => vi.fn())  // GET用: awaitされるPromiseを返す

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      insert: mockInsert,
      select: vi.fn(() => ({ order: mockOrder }))
    }))
  }
}))

// vi.hoisted で mock変数をモックファクトリより先に初期化
const mockAnthropicCreate = vi.hoisted(() => vi.fn())

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockAnthropicCreate }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
      constructor(_opts: any) {}
    }
  }
})

import { POST, GET } from '@/app/api/next-menu/route'

const makePostRequest = (body: object) =>
  new NextRequest('http://localhost/api/next-menu', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }
  })

describe('POST /api/next-menu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // デフォルト: Claude抽出成功
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: '[{"name":"ベンチプレス","sets":5,"reps":5,"weight":82.5}]' }]
    })
    // デフォルト: DB保存成功
    mockSingle.mockResolvedValue({ data: { id: 'test-uuid-123' }, error: null })
  })

  // TC 4-1: 正常系 - 保存成功
  it('有効なcontent + planned_dateで保存成功しidを返す', async () => {
    const req = makePostRequest({
      content: 'ベンチプレス 5×5 @ 82.5kg',
      planned_date: '2026-08-31'
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.id).toBe('test-uuid-123')
  })

  // TC 4-2: exercises JSON が正しく抽出・保存される
  it('Big3を含むメニューのexercisesが正しく抽出される', async () => {
    mockAnthropicCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: '[{"name":"ベンチプレス","sets":5,"reps":5,"weight":82.5},{"name":"デッドリフト","sets":3,"reps":3,"weight":125}]'
      }]
    })
    const req = makePostRequest({ content: 'ベンチ5×5とデッドリフト3×3', planned_date: '2026-08-31' })
    await POST(req)

    const insertCall = (mockInsert.mock.calls as unknown as Array<[Record<string, unknown>]>)[0][0]
    const exs = insertCall.exercises as Array<{ name: string }>
    expect(exs).toHaveLength(2)
    expect(exs[0].name).toBe('ベンチプレス')
    expect(exs[1].name).toBe('デッドリフト')
  })

  // TC 4-3: Big3以外の種目も抽出される
  it('Big3以外の種目もexercisesに含まれる', async () => {
    mockAnthropicCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: '[{"name":"懸垂","sets":3,"reps":8,"weight":null}]'
      }]
    })
    const req = makePostRequest({ content: '懸垂3×8', planned_date: '2026-08-31' })
    await POST(req)

    const insertCall2 = (mockInsert.mock.calls as unknown as Array<[Record<string, unknown>]>)[0][0]
    const exs2 = insertCall2.exercises as Array<{ name: string }>
    expect(exs2[0].name).toBe('懸垂')
  })

  // TC 4-4: contentが空文字は400エラー
  it('contentが空文字の場合400を返す', async () => {
    const req = makePostRequest({ content: '', planned_date: '2026-08-31' })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  // TC 4-5: planned_dateなしでもnullとして保存される
  it('planned_dateなしの場合nullで保存される', async () => {
    const req = makePostRequest({ content: 'ベンチプレス5×5' })
    await POST(req)
    const insertCall3 = (mockInsert.mock.calls as unknown as Array<[Record<string, unknown>]>)[0][0]
    expect(insertCall3.planned_date).toBeNull()
  })

  // TC 4-6: DB保存失敗時は500を返す
  it('DB保存失敗時は500エラーを返す', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } })
    const req = makePostRequest({ content: 'テストメニュー', planned_date: '2026-08-31' })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  // exercises抽出失敗でも保存は続行
  it('Claude抽出結果がパース不能でもDB保存は続行する', async () => {
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'JSON以外のテキスト' }]
    })
    const req = makePostRequest({ content: 'メニューテキスト', planned_date: '2026-08-31' })
    const res = await POST(req)
    const json = await res.json()
    // exercisesがnullでもsuccessになる
    expect(json.success).toBe(true)
    const insertCall4 = (mockInsert.mock.calls as unknown as Array<[Record<string, unknown>]>)[0][0]
    expect(insertCall4.exercises).toBeNull()
  })
})

describe('GET /api/next-menu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // TC 5-1, 5-2: 保存済みメニュー一覧取得
  it('保存済みメニューを配列で返す', async () => {
    mockOrder.mockResolvedValue({
      data: [
        { id: '1', created_at: '2026-08-24T10:00:00Z', planned_date: '2026-08-31', content: 'メニューA', exercises: [] },
        { id: '2', created_at: '2026-08-17T10:00:00Z', planned_date: '2026-08-24', content: 'メニューB', exercises: [] }
      ],
      error: null
    })
    const res = await GET()
    const json = await res.json()
    expect(json.menus).toHaveLength(2)
  })

  // TC 5-3: データなし → 空配列
  it('データがない場合は空配列を返す', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null })
    const res = await GET()
    const json = await res.json()
    expect(json.menus).toEqual([])
  })

  // TC 5-5: Supabaseエラー時はmenusの空配列を返す（クラッシュしない）
  it('Supabaseエラー時はmenusの空配列を返す', async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: 'connection error' } })
    const res = await GET()
    const json = await res.json()
    expect(json.menus).toEqual([])
  })
})
