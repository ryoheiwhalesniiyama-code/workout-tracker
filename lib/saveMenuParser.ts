/** チャットメッセージ内の 【SAVE_MENU:YYYY-MM-DD】 マーカーを検出・解析するユーティリティ */

export const SAVE_MENU_PATTERN = /【SAVE_MENU:(\d{4}-\d{2}-\d{2})】/

export type SaveMenuResult = {
  plannedDate: string   // YYYY-MM-DD
  cleanContent: string  // マーカーを除去したメッセージ本文
}

/**
 * テキストにSAVE_MENUマーカーが含まれていれば解析結果を返す
 * 含まれていなければ null を返す
 */
export function parseSaveMenuMarker(text: string): SaveMenuResult | null {
  const match = text.match(SAVE_MENU_PATTERN)
  if (!match) return null
  return {
    plannedDate: match[1],
    cleanContent: text.replace(SAVE_MENU_PATTERN, '').trim()
  }
}
