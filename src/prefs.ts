/** 编辑器偏好：只影响当前浏览器的写作界面，不进入作品数据。 */

import { writeStorage } from './quota'

export interface EditorPrefs { fontSize: number }

const STORAGE_KEY = 'novel-workbench-next/editor-prefs'
export const FONT_SIZE_RANGE = { min: 14, max: 24, step: 1 } as const
export const DEFAULT_EDITOR_PREFS: EditorPrefs = { fontSize: 17 }

export function loadEditorPrefs(): EditorPrefs {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (parsed && typeof parsed === 'object') {
      const size = (parsed as Partial<EditorPrefs>).fontSize
      if (typeof size === 'number' && Number.isFinite(size)) {
        return { fontSize: Math.min(FONT_SIZE_RANGE.max, Math.max(FONT_SIZE_RANGE.min, Math.round(size))) }
      }
    }
  } catch { /* 无法读取的偏好保留在原存储键 */ }
  return { ...DEFAULT_EDITOR_PREFS }
}

export function saveEditorPrefs(prefs: EditorPrefs): void {
  writeStorage(STORAGE_KEY, prefs)
}
