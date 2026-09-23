import type { ModelProfile, ModelSettings, AiThinkingMode } from './storage'

export interface ModelProviderPreset {
  provider: string
  label: string
  description: string
  baseUrl: string
  maxContext: number
  maxOutputTokens: number
  thinking: AiThinkingMode
}

/** 常用 OpenAI 兼容渠道。Agnes 只作为可选项，初始表单默认 OpenAI。 */
export const MODEL_PROVIDER_PRESETS: ModelProviderPreset[] = [
  { provider: 'openai', label: 'OpenAI', description: 'OpenAI 官方兼容接口', baseUrl: 'https://api.openai.com/v1', maxContext: 128000, maxOutputTokens: 16384, thinking: 'default' },
  { provider: 'deepseek', label: 'DeepSeek', description: 'DeepSeek 官方接口', baseUrl: 'https://api.deepseek.com/v1', maxContext: 1000000, maxOutputTokens: 32768, thinking: 'off' },
  { provider: 'aliyun', label: '通义千问', description: '阿里百炼兼容接口', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', maxContext: 131072, maxOutputTokens: 16384, thinking: 'off' },
  { provider: 'volcengine', label: '火山方舟', description: '豆包 / 方舟兼容接口', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', maxContext: 256000, maxOutputTokens: 32768, thinking: 'off' },
  { provider: 'bigmodel', label: '智谱', description: '智谱开放平台', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', maxContext: 200000, maxOutputTokens: 65536, thinking: 'off' },
  { provider: 'siliconflow', label: '硅基流动', description: '多模型聚合接口', baseUrl: 'https://api.siliconflow.cn/v1', maxContext: 131072, maxOutputTokens: 16384, thinking: 'off' },
  { provider: 'openrouter', label: 'OpenRouter', description: '路由聚合接口', baseUrl: 'https://openrouter.ai/api/v1', maxContext: 200000, maxOutputTokens: 32768, thinking: 'default' },
  { provider: 'minimax', label: 'MiniMax', description: 'MiniMax 官方接口', baseUrl: 'https://api.minimaxi.com/v1', maxContext: 200000, maxOutputTokens: 16384, thinking: 'default' },
  { provider: 'gemini_openai', label: 'Gemini 兼容', description: 'Google OpenAI 兼容接口', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', maxContext: 1000000, maxOutputTokens: 65536, thinking: 'default' },
  { provider: 'xai', label: 'xAI Grok', description: 'xAI 官方接口', baseUrl: 'https://api.x.ai/v1', maxContext: 131072, maxOutputTokens: 16384, thinking: 'default' },
  { provider: 'local', label: '本地部署', description: 'Ollama / LM Studio，可不填密钥', baseUrl: 'http://127.0.0.1:11434/v1', maxContext: 32768, maxOutputTokens: 16384, thinking: 'off' },
  { provider: 'agnes', label: 'Agnes AI', description: 'Agnes 兼容接口（手动选择）', baseUrl: 'https://apihub.agnes-ai.com/v1', maxContext: 256000, maxOutputTokens: 32768, thinking: 'default' },
  { provider: 'custom', label: '自定义', description: '其他 Chat Completions 兼容服务', baseUrl: '', maxContext: 128000, maxOutputTokens: 8192, thinking: 'default' },
]

export const defaultModelDraft = (): Omit<ModelProfile, 'id' | 'createdAt'> => {
  const preset = MODEL_PROVIDER_PRESETS[0]
  return { name: '', provider: preset.provider, baseUrl: preset.baseUrl, model: '', apiKey: '', maxContext: preset.maxContext,
    maxOutputTokens: preset.maxOutputTokens, thinking: preset.thinking, extraParams: '', enabled: true }
}

export function providerPreset(provider: string): ModelProviderPreset {
  return MODEL_PROVIDER_PRESETS.find(item => item.provider === provider) || MODEL_PROVIDER_PRESETS[MODEL_PROVIDER_PRESETS.length - 1]
}

export function inferProvider(provider: string | undefined, baseUrl: string): string {
  if (provider && provider !== 'custom') return provider
  const url = baseUrl.toLowerCase()
  if (url.includes('deepseek')) return 'deepseek'
  if (url.includes('aliyuncs')) return 'aliyun'
  if (url.includes('siliconflow')) return 'siliconflow'
  if (url.includes('bigmodel.cn')) return 'bigmodel'
  if (url.includes('volces.com')) return 'volcengine'
  if (url.includes('openrouter')) return 'openrouter'
  if (url.includes('googleapis')) return 'gemini_openai'
  return provider || 'custom'
}

export function parseExtraParams(value: string | undefined): Record<string, unknown> | undefined {
  const raw = (value || '').trim()
  if (!raw) return undefined
  const parsed: unknown = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('额外请求参数必须是 JSON 对象')
  return parsed as Record<string, unknown>
}

export function modelRequestBody(args: { model: ModelSettings; messages: unknown[]; maxTokens?: number; temperature?: number; stream?: boolean }): Record<string, unknown> {
  const { model, messages, maxTokens, temperature, stream = false } = args
  const provider = inferProvider(model.provider, model.baseUrl)
  const body: Record<string, unknown> = { model: model.model.trim(), messages, stream }
  const requestedTokens = maxTokens || model.maxOutputTokens
  if (requestedTokens) {
    const boundedTokens = Math.max(128, Math.min(Number(model.maxOutputTokens) || requestedTokens, requestedTokens))
    body[model.baseUrl.includes('api.openai.com') && (/^o\d|^gpt-5/i.test(model.model.trim())) ? 'max_completion_tokens' : 'max_tokens'] =
      stream ? boundedTokens : Math.max(boundedTokens, 2048)
  }
  if (temperature !== undefined && !(model.baseUrl.includes('api.openai.com') && (/^o\d|^gpt-5/i.test(model.model.trim())))) body.temperature = temperature
  if (model.thinking === 'off' || model.thinking === 'on') {
    const enabled = model.thinking === 'on'
    if (['deepseek', 'bigmodel', 'volcengine'].includes(provider)) body.thinking = { type: enabled ? 'enabled' : 'disabled' }
    else if (['aliyun', 'siliconflow'].includes(provider)) body.enable_thinking = enabled
    else if (provider === 'openrouter') body.reasoning = { enabled }
    else if (!enabled && ['gemini_openai', 'local'].includes(provider)) body.reasoning_effort = 'none'
  }
  const extra = parseExtraParams(model.extraParams)
  if (extra) Object.assign(body, extra)
  return body
}

export function chatEndpoint(baseUrl: string): string {
  const clean = baseUrl.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(clean)) throw new Error('请填写完整的 API 地址，例如 https://api.openai.com/v1')
  return clean.endsWith('/chat/completions') ? clean : `${clean}/chat/completions`
}

export function modelsEndpoint(baseUrl: string): string {
  const clean = baseUrl.trim().replace(/\/+$/, '')
  return clean.endsWith('/models') ? clean : `${clean}/models`
}

export async function fetchRemoteModelIds(model: ModelSettings, signal: AbortSignal): Promise<string[]> {
  const response = await fetch(modelsEndpoint(model.baseUrl), {
    headers: { ...(model.apiKey.trim() ? { Authorization: `Bearer ${model.apiKey.trim()}` } : {}) }, signal,
  })
  const raw = await response.text()
  let data: any
  try { data = JSON.parse(raw) } catch { throw new Error(`模型列表返回非 JSON（HTTP ${response.status}）`) }
  if (!response.ok || data?.error) throw new Error(`拉取模型列表失败（HTTP ${response.status}）：${data?.error?.message || data?.message || raw.slice(0, 160)}`)
  const items = Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : []
  return items.map((item: any) => typeof item === 'string' ? item : item?.id).filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0).slice(0, 200)
}
