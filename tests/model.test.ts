import { equal, ok, test, throws } from './harness'
import { modelRequestBody, MODEL_PROVIDER_PRESETS } from '../src/model'
import { normalizeModelSettings } from '../src/storage'

test('模型设置把旧版单模型迁移为档案，空配置不预置 Agnes', () => {
  const blank = normalizeModelSettings({ baseUrl: '', model: '', apiKey: '' })
  equal(blank.profiles?.length, 0, '空配置不应创建隐藏模型')
  const legacy = normalizeModelSettings({ baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', apiKey: 'k' })
  equal(legacy.profiles?.length, 1, '旧版配置应迁移成一个模型档案')
  equal(legacy.profiles?.[0].provider, 'custom', '迁移保留旧版自定义服务商语义')
  ok(MODEL_PROVIDER_PRESETS.find(item => item.provider === 'agnes'), 'Agnes 仍可手动选择')
  equal(MODEL_PROVIDER_PRESETS[0].provider, 'openai', '首个默认服务商是 OpenAI')
})

test('模型请求按服务商转换思考模式与 token 字段', () => {
  const body = modelRequestBody({ model: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-reasoner', apiKey: '', provider: 'deepseek', thinking: 'on', maxOutputTokens: 4096 }, messages: [], maxTokens: 1200 })
  equal(JSON.stringify(body.thinking), JSON.stringify({ type: 'enabled' }), 'DeepSeek 使用 thinking.type')
  equal(body.max_tokens, 2048, '非流式输出保留最小安全 token 数')
  const openai = modelRequestBody({ model: { baseUrl: 'https://api.openai.com/v1', model: 'o3-mini', apiKey: '', provider: 'openai', thinking: 'default', maxOutputTokens: 4096 }, messages: [], maxTokens: 3000, temperature: .2 })
  equal(openai.max_completion_tokens, 3000, 'OpenAI 推理模型使用 max_completion_tokens')
  ok(!('temperature' in openai), 'OpenAI 推理模型不发送 temperature')
  throws(() => modelRequestBody({ model: { baseUrl: 'https://x.test/v1', model: 'x', apiKey: '', extraParams: '[]' }, messages: [] }), '额外参数必须是 JSON 对象')
})
