import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/** 扫榜数据与本机番茄下载器 API 代理。正文不在工作台内解析。 */
function rankProxy() {
  return {
    '/rank-proxy/fanqienovel.com': { target: 'https://fanqienovel.com', changeOrigin: true, rewrite: (path: string) => path.replace(/^\/rank-proxy\/fanqienovel\.com/, '') },
    '/rank-proxy/www.qimao.com': { target: 'https://www.qimao.com', changeOrigin: true, rewrite: (path: string) => path.replace(/^\/rank-proxy\/www\.qimao\.com/, '') },
    // Tomato-Novel-Downloader 默认监听 127.0.0.1:18423；代理仅用于本机服务，避免浏览器 CORS。
    '/tomato-proxy': { target: 'http://127.0.0.1:18423', changeOrigin: true, rewrite: (path: string) => path.replace(/^\/tomato-proxy/, '') },
    // 兼容早期工作台构建使用的 /api 与 /download 路径，避免旧页面轮询任务时直接拒绝连接。
    '/api': { target: 'http://127.0.0.1:18423', changeOrigin: true },
    '/download': { target: 'http://127.0.0.1:18423', changeOrigin: true },
  }
}

export default defineConfig({ plugins: [vue()], server: { proxy: rankProxy() }, preview: { proxy: rankProxy() } })
