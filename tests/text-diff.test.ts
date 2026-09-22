import { equal, ok, test } from './harness'
import { diffText } from '../src/text-diff'

const plain = (result: ReturnType<typeof diffText>) => ({
  before: result.before.map(item => `${item.kind}:${item.text}`),
  after: result.after.map(item => `${item.kind}:${item.text}`),
})

test('相同文本没有任何增删', () => {
  const result = diffText('同一段正文。', '同一段正文。')
  equal(result.addedChars, 0)
  equal(result.removedChars, 0)
  equal(result.coarse, false)
  equal(plain(result).after, ['same:同一段正文。'])
})

test('纯新增只出现在修订稿一侧', () => {
  const result = diffText('他推开门。', '他推开门，走了进去。')
  equal(result.before.map(item => item.kind), ['same'], '原稿不应出现增删段')
  equal(result.addedChars, 5, '新增 5 个非空白字符')
  equal(result.removedChars, 0)
  equal(result.after.map(item => item.kind), ['same', 'added', 'same'])
})

test('纯删除只出现在原稿一侧', () => {
  const result = diffText('房间里很安静，只有钟声。', '房间里只有钟声。')
  equal(result.after.map(item => item.kind), ['same'])
  equal(result.removedChars, 4, '删除 4 个非空白字符（含中文逗号）')
  equal(result.addedChars, 0)
})

test('中段改写拆成删除与新增两段', () => {
  const result = diffText('清晨的码头笼罩在雾里', '清晨的港口笼罩在雪里')
  const kinds = result.before.map(item => item.kind)
  ok(kinds.includes('removed') && kinds.includes('same'), '原稿应含删除段')
  equal(result.addedChars, 3)
  equal(result.removedChars, 3)
})

test('增删字数忽略空白字符', () => {
  const result = diffText('甲', '甲\n\n  乙')
  equal(result.addedChars, 1, '换行与空格不计入字数')
})

test('超大改写退化为整段标记为粗粒度', () => {
  const before = Array.from({ length: 1400 }, (_, index) => `第${index}行内容`).join('\n')
  const after = Array.from({ length: 1400 }, (_, index) => `第${index}行改动`).join('\n')
  const result = diffText(before, after)
  equal(result.coarse, true, '超出细比上限时应标记为粗粒度')
  ok(result.removedChars > 0 && result.addedChars > 0, '仍应报告增删规模')
})

test('按 Unicode 字符比较，代理对算一个字符', () => {
  const result = diffText('他笑了😊', '他哭了😊')
  equal(result.removedChars, 1)
  equal(result.addedChars, 1)
})
