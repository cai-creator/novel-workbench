/** 五个 localStorage 键共用浏览器同一份约 5MB 配额。
 *  所有持久化写入统一走 writeStorage：写前预检体积，失败时转成面向用户的中文错误并广播一次告警，
 *  不再有「静默失败」和「原始 DOMException 乱飞」两种极端。 */

/** 主流浏览器给每个 origin 的 localStorage 配额约 5MB，超过这个体量的单次写入注定失败。 */
const STORAGE_BUDGET_BYTES = 5 * 1024 * 1024

/** 配额溢出时给用户的统一提示。 */
export const STORAGE_QUOTA_MESSAGE = '浏览器存储空间已满，本次改动没能保存到本机。请先导出备份，再清理不需要的旧数据。'

/** 配额溢出或序列化失败：文案面向用户，调用方按各自的提示渠道展示。 */
export class StorageQuotaError extends Error {
  constructor(message = STORAGE_QUOTA_MESSAGE) {
    super(message)
    this.name = 'StorageQuotaError'
  }
}

type QuotaWarningListener = (message: string) => void
const warningListeners = new Set<QuotaWarningListener>()

/** 订阅配额告警：App 用它把写失败弹成 toast，保证任何一次失败都至少有一次可见提示。 */
export function onQuotaWarning(listener: QuotaWarningListener): () => void {
  warningListeners.add(listener)
  return () => { warningListeners.delete(listener) }
}

/** 广播配额告警；某个订阅者自己抛错不影响其余订阅者和写入方的错误类型。 */
export function reportQuotaWarning(message: string = STORAGE_QUOTA_MESSAGE): void {
  for (const listener of [...warningListeners]) {
    try { listener(message) } catch { /* 告警渠道出错不能改写写入方的错误 */ }
  }
}

/** localStorage 配额按 UTF-8 字节算，中文一字三字节，不能直接数字符个数。 */
function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length
}

function quotaFailure(message: string): StorageQuotaError {
  reportQuotaWarning(message)
  return new StorageQuotaError(message)
}

/** 统一写入入口：序列化、体积预检、setItem 都走这一条路。 */
export function writeStorage(key: string, value: unknown): void {
  let text: string
  try {
    text = JSON.stringify(value)
  } catch {
    throw quotaFailure('要保存的内容无法处理，本次改动没有保存。')
  }
  const bytes = utf8Bytes(text)
  if (bytes > STORAGE_BUDGET_BYTES) {
    throw quotaFailure(`本次要保存的内容约 ${(bytes / 1024 / 1024).toFixed(1)}MB，超出浏览器约 5MB 的存储上限，未能保存。请分拆或清理旧数据后重试。`)
  }
  try {
    localStorage.setItem(key, text)
  } catch {
    throw quotaFailure(STORAGE_QUOTA_MESSAGE)
  }
}
