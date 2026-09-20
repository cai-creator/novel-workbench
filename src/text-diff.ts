export interface DiffSegment {
  kind: 'same' | 'added' | 'removed'
  text: string
}

export interface TextDiffResult {
  before: DiffSegment[]
  after: DiffSegment[]
  addedChars: number
  removedChars: number
  coarse: boolean
}

interface DiffState { before: DiffSegment[]; after: DiffSegment[]; coarse: boolean }
const MAX_CHARACTER_CELLS = 1_500_000
const MAX_LINE_CELLS = 200_000

function append(segments: DiffSegment[], kind: DiffSegment['kind'], text: string): void {
  if (!text) return
  const last = segments[segments.length - 1]
  if (last?.kind === kind) last.text += text
  else segments.push({ kind, text })
}

function same(state: DiffState, text: string): void {
  append(state.before, 'same', text)
  append(state.after, 'same', text)
}

function exactCharacters(before: string[], after: string[], state: DiffState): void {
  const width = after.length + 1
  const matrix = new Uint32Array((before.length + 1) * width)
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      matrix[i * width + j] = before[i] === after[j]
        ? matrix[(i + 1) * width + j + 1] + 1
        : Math.max(matrix[(i + 1) * width + j], matrix[i * width + j + 1])
    }
  }
  let i = 0, j = 0
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) { same(state, before[i]); i++; j++ }
    else if (matrix[(i + 1) * width + j] >= matrix[i * width + j + 1]) append(state.before, 'removed', before[i++])
    else append(state.after, 'added', after[j++])
  }
  while (i < before.length) append(state.before, 'removed', before[i++])
  while (j < after.length) append(state.after, 'added', after[j++])
}

/** 大稿优先寻找完全相同的行作锚点，只细比锚点之间的文字。 */
function lineAnchors(before: string[], after: string[]): Array<[number, number]> {
  const width = after.length + 1
  const matrix = new Uint32Array((before.length + 1) * width)
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      matrix[i * width + j] = before[i] === after[j]
        ? matrix[(i + 1) * width + j + 1] + 1
        : Math.max(matrix[(i + 1) * width + j], matrix[i * width + j + 1])
    }
  }
  const anchors: Array<[number, number]> = []
  let i = 0, j = 0
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) { anchors.push([i, j]); i++; j++ }
    else if (matrix[(i + 1) * width + j] >= matrix[i * width + j + 1]) i++
    else j++
  }
  return anchors
}

function compare(beforeText: string, afterText: string, state: DiffState, depth = 0): void {
  if (beforeText === afterText) { same(state, beforeText); return }
  const before = Array.from(beforeText)
  const after = Array.from(afterText)
  let prefix = 0
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++
  let suffix = 0
  while (suffix < before.length - prefix && suffix < after.length - prefix &&
    before[before.length - suffix - 1] === after[after.length - suffix - 1]) suffix++
  same(state, before.slice(0, prefix).join(''))
  const left = before.slice(prefix, before.length - suffix)
  const right = after.slice(prefix, after.length - suffix)
  if (!left.length) append(state.after, 'added', right.join(''))
  else if (!right.length) append(state.before, 'removed', left.join(''))
  else if (left.length * right.length <= MAX_CHARACTER_CELLS) exactCharacters(left, right, state)
  else {
    const leftText = left.join(''), rightText = right.join('')
    const leftLines = leftText.match(/[^\n]*\n|[^\n]+$/g) || []
    const rightLines = rightText.match(/[^\n]*\n|[^\n]+$/g) || []
    const anchors = depth < 3 && leftLines.length * rightLines.length <= MAX_LINE_CELLS &&
      (leftLines.length > 1 || rightLines.length > 1) ? lineAnchors(leftLines, rightLines) : []
    if (anchors.length) {
      let leftStart = 0, rightStart = 0
      for (const [leftIndex, rightIndex] of anchors) {
        compare(leftLines.slice(leftStart, leftIndex).join(''), rightLines.slice(rightStart, rightIndex).join(''), state, depth + 1)
        same(state, leftLines[leftIndex])
        leftStart = leftIndex + 1
        rightStart = rightIndex + 1
      }
      compare(leftLines.slice(leftStart).join(''), rightLines.slice(rightStart).join(''), state, depth + 1)
    } else {
      append(state.before, 'removed', leftText)
      append(state.after, 'added', rightText)
      state.coarse = true
    }
  }
  same(state, before.slice(before.length - suffix).join(''))
}

/** 按 Unicode 字符比较；超大改写在相同段落间细比，其余显示整段变化。 */
export function diffText(before: string, after: string): TextDiffResult {
  const state: DiffState = { before: [], after: [], coarse: false }
  compare(before, after, state)
  const count = (text: string) => Array.from(text.replace(/\s/g, '')).length
  return { before: state.before, after: state.after,
    addedChars: state.after.reduce((sum, item) => sum + (item.kind === 'added' ? count(item.text) : 0), 0),
    removedChars: state.before.reduce((sum, item) => sum + (item.kind === 'removed' ? count(item.text) : 0), 0),
    coarse: state.coarse }
}
