import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import PlanPage from '@/app/plan/page'

// next/link モック
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  )
}))

// fetch モック
const mockFetch = vi.fn()
global.fetch = mockFetch

const mockMenus = [
  {
    id: '1',
    created_at: '2026-08-24T10:00:00Z',
    planned_date: '2026-08-31',
    content: 'ベンチプレス5×5 @ 82.5kg',
    exercises: [{ name: 'ベンチプレス', sets: 5, reps: 5, weight: 82.5 }]
  },
  {
    id: '2',
    created_at: '2026-08-17T10:00:00Z',
    planned_date: '2026-08-24',
    content: 'デッドリフト3×3',
    exercises: [{ name: 'デッドリフト', sets: 3, reps: 3, weight: 125 }]
  }
]

describe('PlanPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // TC 5-1: 保存済みメニューが表示される
  it('保存済みメニューが一覧表示される', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ menus: mockMenus })
    })
    render(<PlanPage />)
    await waitFor(() => {
      expect(screen.getByText('ベンチプレス')).toBeInTheDocument()
      expect(screen.getByText('デッドリフト')).toBeInTheDocument()
    })
  })

  // TC 5-2: 最新メニューに「最新」バッジ
  it('最初のメニューに「最新」バッジが表示される', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ menus: mockMenus })
    })
    render(<PlanPage />)
    await waitFor(() => {
      expect(screen.getByText('最新')).toBeInTheDocument()
    })
  })

  // TC 5-3: メニューなし → 空状態メッセージ
  it('メニューがない場合は空状態メッセージを表示する', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ menus: [] })
    })
    render(<PlanPage />)
    await waitFor(() => {
      expect(screen.getByText('まだ次回メニューがありません')).toBeInTheDocument()
    })
  })

  // TC 5-4: exercises が正しく表示される
  it('種目名・セット数・rep数・重量が表示される', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ menus: [mockMenus[0]] })
    })
    render(<PlanPage />)
    await waitFor(() => {
      expect(screen.getByText('ベンチプレス')).toBeInTheDocument()
      expect(screen.getByText('5×5rep @ 82.5kg')).toBeInTheDocument()
    })
  })

  // TC 5-5: fetch失敗 → エラーメッセージ（クラッシュしない）
  it('fetch失敗時はエラーメッセージを表示しクラッシュしない', async () => {
    mockFetch.mockRejectedValue(new Error('network error'))
    render(<PlanPage />)
    await waitFor(() => {
      expect(screen.getByText('読み込みに失敗しました')).toBeInTheDocument()
    })
  })

  // exercises nullの場合は生テキストを表示
  it('exercisesがnullの場合はcontentテキストを表示する', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({
        menus: [{ ...mockMenus[0], exercises: null }]
      })
    })
    render(<PlanPage />)
    await waitFor(() => {
      expect(screen.getByText('ベンチプレス5×5 @ 82.5kg')).toBeInTheDocument()
    })
  })
})
