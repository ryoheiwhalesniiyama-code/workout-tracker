import { describe, it, expect } from 'vitest'
import { parseSaveMenuMarker, SAVE_MENU_PATTERN } from '@/lib/saveMenuParser'

describe('parseSaveMenuMarker', () => {
  // 正常系
  it('マーカーありの文字列を正しく解析する', () => {
    const text = '9月1日（月）で保存しました ✅【SAVE_MENU:2026-09-01】'
    const result = parseSaveMenuMarker(text)
    expect(result).not.toBeNull()
    expect(result?.plannedDate).toBe('2026-09-01')
    expect(result?.cleanContent).toBe('9月1日（月）で保存しました ✅')
  })

  it('マーカーなしの文字列はnullを返す', () => {
    const text = '次回はベンチプレス82.5kgでいきましょう'
    expect(parseSaveMenuMarker(text)).toBeNull()
  })

  it('マーカーを除去したcleanContentにマーカーが含まれない', () => {
    const text = '保存しました【SAVE_MENU:2026-08-31】'
    const result = parseSaveMenuMarker(text)
    expect(result?.cleanContent).not.toMatch(SAVE_MENU_PATTERN)
  })

  it('マーカーが末尾にある場合もtrimされる', () => {
    const text = 'メニュー確定です【SAVE_MENU:2026-09-07】  '
    const result = parseSaveMenuMarker(text)
    expect(result?.cleanContent).toBe('メニュー確定です')
  })

  it('マーカーが文中にある場合も正しく除去する', () => {
    const text = '【SAVE_MENU:2026-09-01】確定しました'
    const result = parseSaveMenuMarker(text)
    expect(result?.plannedDate).toBe('2026-09-01')
    expect(result?.cleanContent).toBe('確定しました')
  })

  // 異常系・エッジケース
  it('不正な日付フォーマットはマッチしない', () => {
    const text = '保存【SAVE_MENU:2026/09/01】'  // スラッシュ区切り
    expect(parseSaveMenuMarker(text)).toBeNull()
  })

  it('空文字列はnullを返す', () => {
    expect(parseSaveMenuMarker('')).toBeNull()
  })

  it('マーカーのみの文字列はcleanContentが空文字になる', () => {
    const text = '【SAVE_MENU:2026-09-01】'
    const result = parseSaveMenuMarker(text)
    expect(result?.cleanContent).toBe('')
  })

  it('plannedDateがYYYY-MM-DD形式で返る', () => {
    const text = '確定【SAVE_MENU:2026-12-31】'
    const result = parseSaveMenuMarker(text)
    expect(result?.plannedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
