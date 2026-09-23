/** 为纯逻辑测试提供浏览器全局对象的最小替身。 */
const store = new Map()
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => { store.set(key, String(value)) },
  removeItem: (key) => { store.delete(key) },
  clear: () => { store.clear() },
  key: (index) => [...store.keys()][index] ?? null,
  get length() { return store.size },
}
if (!globalThis.confirm) globalThis.confirm = () => true
if (!globalThis.alert) globalThis.alert = () => {}
