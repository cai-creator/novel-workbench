import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/** 扫榜抓取用的白名单代理：浏览器直连番茄/七猫会被 CORS 拦下，dev 与 preview 都挂同一份规则。 */
function rankProxy() {
  return {
    '/rank-proxy/fanqienovel.com': { target: 'https://fanqienovel.com', changeOrigin: true, rewrite: (path: string) => path.replace(/^\/rank-proxy\/fanqienovel\.com/, '') },
    '/rank-proxy/www.qimao.com': { target: 'https://www.qimao.com', changeOrigin: true, rewrite: (path: string) => path.replace(/^\/rank-proxy\/www\.qimao\.com/, '') },
    // 只代理扫榜已支持的两个站点；正文读取仍由用户主动发起，并不开放任意站点代理。
    '/novel-proxy/fanqienovel.com': { target: 'https://fanqienovel.com', changeOrigin: true, rewrite: (path: string) => path.replace(/^\/novel-proxy\/fanqienovel\.com/, '') },
    '/novel-proxy/www.qimao.com': { target: 'https://www.qimao.com', changeOrigin: true, rewrite: (path: string) => path.replace(/^\/novel-proxy\/www\.qimao\.com/, '') },
  }
}

export default defineConfig({ plugins: [vue()], server: { proxy: rankProxy() }, preview: { proxy: rankProxy() } })
