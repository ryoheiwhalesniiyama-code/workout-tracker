import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import ChatPage from '@/app/chat/page'

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

describe('コーチ画面', () => {
  it('長い回答も省略せず表示し、メニューは明示的な確認後にだけ保存する', async () => {
    const draft = {
      draftId: '12345678-1234-4123-8123-123456789abc', plannedDate: '2026-11-07', trainingDay: 'chest',
      exercises: [{ name: 'ベンチプレス', sets: 3, reps: 5, weight: 82.5 }],
      hypothesis: '疲労の影響', change: 'セットを減らす', check: '肩の張り', notes: '',
    }
    const fetchMock = vi.fn().mockImplementation((url: string) => Promise.resolve({
      ok: true, json: async () => url === '/api/next-menu' ? { id: draft.draftId } : {
        messages: [{ role: 'assistant', content: `目標達成おめでとう。\n\n${'比較の根拠。'.repeat(120)}\n\n次回は肩の張りを確認。`, draft }],
        reviews: [], savedPlanIds: [], contextStart: '2026-10-31',
      },
    }))
    vi.stubGlobal('fetch', fetchMock)
    render(<ChatPage />)
    expect(await screen.findByText('次回は肩の張りを確認。')).toBeInTheDocument()
    expect(screen.getByText('2026年11月7日（土）')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/next-menu')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'この日付・方針で保存' }))
    await waitFor(() => expect(screen.getByText(/計画を保存しました/)).toBeInTheDocument())
    const save = fetchMock.mock.calls.find(([url]) => url === '/api/next-menu')
    expect(JSON.parse(save![1].body).draft.plannedDate).toBe('2026-11-07')
    vi.unstubAllGlobals()
  })
})
