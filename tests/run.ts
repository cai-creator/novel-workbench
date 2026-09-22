/** 测试入口：node --experimental-strip-types --import ./tests/setup.mjs --loader ./tests/loader.mjs tests/run.ts */
import './setup.mjs'
import { readdir } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runAll } from './harness'

const dir = fileURLToPath(new URL('.', import.meta.url))
const files = (await readdir(dir)).filter(name => name.endsWith('.test.ts')).sort()
for (const file of files) await import(pathToFileURL(`${dir}${file}`).href)
await runAll('逻辑测试')
