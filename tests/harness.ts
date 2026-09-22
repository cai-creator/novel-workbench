/** 测试注册与断言：被测试文件引用，自身不加载任何测试文件。 */
interface TestCase { name: string; fn: () => void | Promise<void> }

const cases: TestCase[] = []

export function test(name: string, fn: () => void | Promise<void>) { cases.push({ name, fn }) }

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}
export function equal<T>(actual: T, expected: T, message = '') {
  const a = JSON.stringify(actual)
  const b = JSON.stringify(expected)
  assert(a === b, `${message}\n  期望: ${b}\n  实际: ${a}`)
}
export function ok(condition: unknown, message: string) { assert(condition, message) }
export function throws(fn: () => unknown, message: string) {
  let failed = false
  try { fn() } catch { failed = true }
  assert(failed, message)
}

export async function runAll(label: string) {
  let passed = 0
  const failures: string[] = []
  for (const item of cases) {
    try {
      await item.fn()
      passed += 1
      console.log(`  ✓ ${item.name}`)
    } catch (error) {
      failures.push(`${item.name}\n    ${error instanceof Error ? error.message : String(error)}`)
      console.log(`  ✗ ${item.name}`)
    }
  }
  console.log(`\n[${label}] ${passed}/${cases.length} 通过${failures.length ? `，${failures.length} 失败：\n${failures.map(item => `  - ${item}`).join('\n')}` : ''}`)
  if (failures.length) process.exitCode = 1
}
