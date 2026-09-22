/**
 * 扫榜源清单（移植自 easy-writing 的 defaultSeed）：站点 / 分类 / 榜单源。
 *
 * - 番茄：分类阅读榜/新书榜各一批源，抓榜单页 HTML 首屏（SSR 直出）
 * - 七猫：官方 JSON 接口源（大热/新书/收藏），带翻页
 * - 起点：反爬需要隐藏窗口 + 反爬字体解码，属桌面版能力，浏览器版未接入
 * 平台改版时优先改这里的 url / 解析器选择器，不动存储与页面。
 */

export interface RankSeedSite {
  legacyId: number
  code: 'fanqie' | 'qimao'
  name: string
  baseUrl: string | null
  enabled: 0 | 1
  remark?: string | null
}

export interface RankSeedCategory {
  legacyId: number
  siteCode: 'fanqie' | 'qimao'
  gender: 'male' | 'female'
  name: string
  code: string
  enabled: 0 | 1
  sortNo: number
  parentLegacyId: number | null
}

export interface RankSeedSource {
  legacyId: number
  siteCode: 'fanqie' | 'qimao'
  categoryLegacyId: number | null
  rankType: string
  title: string | null
  url: string
  enabled: 0 | 1
  meta: Record<string, unknown> | null
}

const RANK_SITES: RankSeedSite[] = [
  {"legacyId": 1, "code": "fanqie", "name": "番茄小说网", "baseUrl": "https://fanqienovel.com", "enabled": 1, "remark": null},
  {"legacyId": 3, "code": "qimao", "name": "七猫小说网", "baseUrl": "https://www.qimao.com", "enabled": 1, "remark": null},
]

const RANK_CATEGORIES: RankSeedCategory[] = [
  {"legacyId": 1, "siteCode": "fanqie", "gender": "male", "name": "都市高武", "code": "1_2_1014", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 2, "siteCode": "fanqie", "gender": "male", "name": "玄幻脑洞", "code": "1_2_257", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 3, "siteCode": "fanqie", "gender": "male", "name": "男频衍生", "code": "1_2_1016", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 4, "siteCode": "fanqie", "gender": "male", "name": "西方奇幻", "code": "1_2_1141", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 5, "siteCode": "fanqie", "gender": "male", "name": "东方仙侠", "code": "1_2_1140", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 6, "siteCode": "fanqie", "gender": "male", "name": "科幻末世", "code": "1_2_8", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 7, "siteCode": "fanqie", "gender": "male", "name": "都市日常", "code": "1_2_261", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 8, "siteCode": "fanqie", "gender": "male", "name": "都市修真", "code": "1_2_124", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 9, "siteCode": "fanqie", "gender": "male", "name": "历史古代", "code": "1_2_273", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 10, "siteCode": "fanqie", "gender": "male", "name": "战神赘婿", "code": "1_2_27", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 11, "siteCode": "fanqie", "gender": "male", "name": "都市种田", "code": "1_2_263", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 12, "siteCode": "fanqie", "gender": "male", "name": "传统玄幻", "code": "1_2_258", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 13, "siteCode": "fanqie", "gender": "male", "name": "历史脑洞", "code": "1_2_272", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 14, "siteCode": "fanqie", "gender": "male", "name": "悬疑脑洞", "code": "1_2_539", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 15, "siteCode": "fanqie", "gender": "male", "name": "都市脑洞", "code": "1_2_262", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 16, "siteCode": "fanqie", "gender": "male", "name": "悬疑灵异", "code": "1_2_751", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 17, "siteCode": "fanqie", "gender": "male", "name": "抗战谍战", "code": "1_2_504", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 18, "siteCode": "fanqie", "gender": "male", "name": "游戏体育", "code": "1_2_746", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 19, "siteCode": "fanqie", "gender": "male", "name": "动漫衍生", "code": "1_2_718", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 60, "siteCode": "qimao", "gender": "male", "name": "都市", "code": "a-203", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 61, "siteCode": "qimao", "gender": "male", "name": "都市高武", "code": "a-203-219", "enabled": 1, "sortNo": 0, "parentLegacyId": 60},
  {"legacyId": 62, "siteCode": "qimao", "gender": "male", "name": "都市高手", "code": "a-203-220", "enabled": 1, "sortNo": 0, "parentLegacyId": 60},
  {"legacyId": 63, "siteCode": "qimao", "gender": "male", "name": "历史", "code": "a-56", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 64, "siteCode": "qimao", "gender": "male", "name": "架空历史", "code": "a-56-58", "enabled": 1, "sortNo": 0, "parentLegacyId": 63},
  {"legacyId": 65, "siteCode": "qimao", "gender": "male", "name": "官场", "code": "a-203-315", "enabled": 1, "sortNo": 0, "parentLegacyId": 60},
  {"legacyId": 66, "siteCode": "qimao", "gender": "male", "name": "商战职场", "code": "a-203-221", "enabled": 1, "sortNo": 0, "parentLegacyId": 60},
  {"legacyId": 67, "siteCode": "qimao", "gender": "male", "name": "玄幻奇幻", "code": "a-202", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 68, "siteCode": "qimao", "gender": "male", "name": "东方玄幻", "code": "a-202-37", "enabled": 1, "sortNo": 0, "parentLegacyId": 67},
  {"legacyId": 69, "siteCode": "qimao", "gender": "male", "name": "都市生活", "code": "a-203-223", "enabled": 1, "sortNo": 0, "parentLegacyId": 60},
  {"legacyId": 70, "siteCode": "qimao", "gender": "male", "name": "异世大陆", "code": "a-202-39", "enabled": 1, "sortNo": 0, "parentLegacyId": 67},
  {"legacyId": 71, "siteCode": "qimao", "gender": "male", "name": "乡村生活", "code": "a-203-48", "enabled": 1, "sortNo": 0, "parentLegacyId": 60},
  {"legacyId": 72, "siteCode": "qimao", "gender": "male", "name": "科幻", "code": "a-64", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 73, "siteCode": "qimao", "gender": "male", "name": "末世危机", "code": "a-64-66", "enabled": 1, "sortNo": 0, "parentLegacyId": 72},
  {"legacyId": 74, "siteCode": "qimao", "gender": "male", "name": "热血校园", "code": "a-203-222", "enabled": 1, "sortNo": 0, "parentLegacyId": 60},
  {"legacyId": 75, "siteCode": "qimao", "gender": "male", "name": "武侠仙侠", "code": "a-205", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 76, "siteCode": "qimao", "gender": "male", "name": "幻想修真", "code": "a-205-225", "enabled": 1, "sortNo": 0, "parentLegacyId": 75},
  {"legacyId": 77, "siteCode": "qimao", "gender": "male", "name": "游戏", "code": "a-75", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 78, "siteCode": "qimao", "gender": "male", "name": "虚拟网游", "code": "a-75-232", "enabled": 1, "sortNo": 0, "parentLegacyId": 77},
  {"legacyId": 79, "siteCode": "qimao", "gender": "male", "name": "奇闻异事", "code": "a-204", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 80, "siteCode": "qimao", "gender": "male", "name": "奇门秘术", "code": "a-204-231", "enabled": 1, "sortNo": 0, "parentLegacyId": 79},
  {"legacyId": 81, "siteCode": "qimao", "gender": "male", "name": "穿越历史", "code": "a-56-57", "enabled": 1, "sortNo": 0, "parentLegacyId": 63},
  {"legacyId": 84, "siteCode": "qimao", "gender": "male", "name": "明星娱乐", "code": "a-203-46", "enabled": 1, "sortNo": 0, "parentLegacyId": 60},
  {"legacyId": 86, "siteCode": "fanqie", "gender": "male", "name": "西方奇幻", "code": "1_1_1141", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 87, "siteCode": "fanqie", "gender": "male", "name": "东方仙侠", "code": "1_1_1140", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 88, "siteCode": "fanqie", "gender": "male", "name": "科幻末世", "code": "1_1_8", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 89, "siteCode": "fanqie", "gender": "male", "name": "都市日常", "code": "1_1_261", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 90, "siteCode": "fanqie", "gender": "male", "name": "都市修真", "code": "1_1_124", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 91, "siteCode": "fanqie", "gender": "male", "name": "都市高武", "code": "1_1_1014", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 92, "siteCode": "fanqie", "gender": "male", "name": "历史古代", "code": "1_1_273", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 93, "siteCode": "fanqie", "gender": "male", "name": "战神赘婿", "code": "1_1_27", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 94, "siteCode": "fanqie", "gender": "male", "name": "都市种田", "code": "1_1_263", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 95, "siteCode": "fanqie", "gender": "male", "name": "传统玄幻", "code": "1_1_258", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 96, "siteCode": "fanqie", "gender": "male", "name": "历史脑洞", "code": "1_1_272", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 97, "siteCode": "fanqie", "gender": "male", "name": "悬疑脑洞", "code": "1_1_539", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 98, "siteCode": "fanqie", "gender": "male", "name": "都市脑洞", "code": "1_1_262", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 99, "siteCode": "fanqie", "gender": "male", "name": "玄幻脑洞", "code": "1_1_257", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 100, "siteCode": "fanqie", "gender": "male", "name": "悬疑灵异", "code": "1_1_751", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 101, "siteCode": "fanqie", "gender": "male", "name": "抗战谍战", "code": "1_1_504", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 102, "siteCode": "fanqie", "gender": "male", "name": "游戏体育", "code": "1_1_746", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 103, "siteCode": "fanqie", "gender": "male", "name": "动漫衍生", "code": "1_1_718", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 104, "siteCode": "fanqie", "gender": "male", "name": "男频衍生", "code": "1_1_1016", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 121, "siteCode": "qimao", "gender": "male", "name": "军事", "code": "a-60", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 122, "siteCode": "qimao", "gender": "male", "name": "N次元", "code": "a-207", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 123, "siteCode": "qimao", "gender": "male", "name": "现代军事", "code": "a-60-61", "enabled": 1, "sortNo": 0, "parentLegacyId": 121},
  {"legacyId": 124, "siteCode": "qimao", "gender": "male", "name": "恐怖灵异", "code": "a-204-229", "enabled": 1, "sortNo": 0, "parentLegacyId": 79},
  {"legacyId": 125, "siteCode": "qimao", "gender": "male", "name": "衍生同人", "code": "a-207-239", "enabled": 1, "sortNo": 0, "parentLegacyId": 122},
  {"legacyId": 126, "siteCode": "qimao", "gender": "male", "name": "王朝争霸", "code": "a-202-218", "enabled": 1, "sortNo": 0, "parentLegacyId": 67},
  {"legacyId": 127, "siteCode": "qimao", "gender": "male", "name": "古典仙侠", "code": "a-205-52", "enabled": 1, "sortNo": 0, "parentLegacyId": 75},
  {"legacyId": 128, "siteCode": "qimao", "gender": "male", "name": "未来幻想", "code": "a-64-67", "enabled": 1, "sortNo": 0, "parentLegacyId": 72},
  {"legacyId": 129, "siteCode": "qimao", "gender": "male", "name": "上古洪荒", "code": "a-205-38", "enabled": 1, "sortNo": 0, "parentLegacyId": 75},
  {"legacyId": 130, "siteCode": "qimao", "gender": "male", "name": "电子竞技", "code": "a-75-78", "enabled": 1, "sortNo": 0, "parentLegacyId": 77},
  {"legacyId": 133, "siteCode": "qimao", "gender": "male", "name": "灵气复苏", "code": "a-203-314", "enabled": 1, "sortNo": 0, "parentLegacyId": 60},
  {"legacyId": 143, "siteCode": "fanqie", "gender": "female", "name": "古风世情", "code": "0_2_1139", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 144, "siteCode": "fanqie", "gender": "female", "name": "科幻末世", "code": "0_2_8", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 145, "siteCode": "fanqie", "gender": "female", "name": "游戏体育", "code": "0_2_746", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 146, "siteCode": "fanqie", "gender": "female", "name": "女频衍生", "code": "0_2_1015", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 147, "siteCode": "fanqie", "gender": "female", "name": "玄幻言情", "code": "0_2_248", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 148, "siteCode": "fanqie", "gender": "female", "name": "种田", "code": "0_2_23", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 149, "siteCode": "fanqie", "gender": "female", "name": "年代", "code": "0_2_79", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 150, "siteCode": "fanqie", "gender": "female", "name": "现言脑洞", "code": "0_2_267", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 151, "siteCode": "fanqie", "gender": "female", "name": "宫斗宅斗", "code": "0_2_246", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 152, "siteCode": "fanqie", "gender": "female", "name": "悬疑脑洞", "code": "0_2_539", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 153, "siteCode": "fanqie", "gender": "female", "name": "古言脑洞", "code": "0_2_253", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 154, "siteCode": "fanqie", "gender": "female", "name": "快穿", "code": "0_2_24", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 155, "siteCode": "fanqie", "gender": "female", "name": "青春甜宠", "code": "0_2_749", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 156, "siteCode": "fanqie", "gender": "female", "name": "星光璀璨", "code": "0_2_745", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 157, "siteCode": "fanqie", "gender": "female", "name": "女频悬疑", "code": "0_2_747", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 158, "siteCode": "fanqie", "gender": "female", "name": "职场婚恋", "code": "0_2_750", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 159, "siteCode": "fanqie", "gender": "female", "name": "豪门总裁", "code": "0_2_748", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 160, "siteCode": "fanqie", "gender": "female", "name": "民国言情", "code": "0_2_1017", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 161, "siteCode": "fanqie", "gender": "female", "name": "古风世情", "code": "0_1_1139", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 162, "siteCode": "fanqie", "gender": "female", "name": "科幻末世", "code": "0_1_8", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 163, "siteCode": "fanqie", "gender": "female", "name": "游戏体育", "code": "0_1_746", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 164, "siteCode": "fanqie", "gender": "female", "name": "女频衍生", "code": "0_1_1015", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 165, "siteCode": "fanqie", "gender": "female", "name": "玄幻言情", "code": "0_1_248", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 166, "siteCode": "fanqie", "gender": "female", "name": "种田", "code": "0_1_23", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 167, "siteCode": "fanqie", "gender": "female", "name": "年代", "code": "0_1_79", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 168, "siteCode": "fanqie", "gender": "female", "name": "现言脑洞", "code": "0_1_267", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 169, "siteCode": "fanqie", "gender": "female", "name": "宫斗宅斗", "code": "0_1_246", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 170, "siteCode": "fanqie", "gender": "female", "name": "悬疑脑洞", "code": "0_1_539", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 171, "siteCode": "fanqie", "gender": "female", "name": "古言脑洞", "code": "0_1_253", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 172, "siteCode": "fanqie", "gender": "female", "name": "快穿", "code": "0_1_24", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 173, "siteCode": "fanqie", "gender": "female", "name": "青春甜宠", "code": "0_1_749", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 174, "siteCode": "fanqie", "gender": "female", "name": "星光璀璨", "code": "0_1_745", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 175, "siteCode": "fanqie", "gender": "female", "name": "女频悬疑", "code": "0_1_747", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 176, "siteCode": "fanqie", "gender": "female", "name": "职场婚恋", "code": "0_1_750", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 177, "siteCode": "fanqie", "gender": "female", "name": "豪门总裁", "code": "0_1_748", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
  {"legacyId": 178, "siteCode": "fanqie", "gender": "female", "name": "民国言情", "code": "0_1_1017", "enabled": 1, "sortNo": 0, "parentLegacyId": null},
]

export const RANK_SOURCES: RankSeedSource[] = [
  {"legacyId": 1, "siteCode": "fanqie", "categoryLegacyId": 1, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/1_2_1014", "enabled": 1, "meta": {"maxPages": 2}},
  {"legacyId": 2, "siteCode": "fanqie", "categoryLegacyId": 2, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/1_2_257", "enabled": 1, "meta": {"maxPages": 2}},
  {"legacyId": 3, "siteCode": "fanqie", "categoryLegacyId": 3, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/1_2_1016", "enabled": 1, "meta": {"gender": "male", "maxPages": 2, "pageMode": null, "scope": "category"}},
  {"legacyId": 4, "siteCode": "fanqie", "categoryLegacyId": 4, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/1_2_1141", "enabled": 1, "meta": {"maxPages": 2}},
  {"legacyId": 5, "siteCode": "fanqie", "categoryLegacyId": 5, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/1_2_1140", "enabled": 1, "meta": {"maxPages": 2}},
  {"legacyId": 6, "siteCode": "fanqie", "categoryLegacyId": 6, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/1_2_8", "enabled": 1, "meta": {"maxPages": 2}},
  {"legacyId": 7, "siteCode": "fanqie", "categoryLegacyId": 7, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/1_2_261", "enabled": 1, "meta": {"maxPages": 2}},
  {"legacyId": 8, "siteCode": "fanqie", "categoryLegacyId": 8, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/1_2_124", "enabled": 1, "meta": {"maxPages": 2}},
  {"legacyId": 9, "siteCode": "fanqie", "categoryLegacyId": 9, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/1_2_273", "enabled": 1, "meta": {"maxPages": 2}},
  {"legacyId": 10, "siteCode": "fanqie", "categoryLegacyId": 10, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/1_2_27", "enabled": 1, "meta": {"maxPages": 2}},
  {"legacyId": 11, "siteCode": "fanqie", "categoryLegacyId": 11, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/1_2_263", "enabled": 1, "meta": {"maxPages": 2}},
  {"legacyId": 12, "siteCode": "fanqie", "categoryLegacyId": 12, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/1_2_258", "enabled": 1, "meta": {"maxPages": 2}},
  {"legacyId": 13, "siteCode": "fanqie", "categoryLegacyId": 13, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/1_2_272", "enabled": 1, "meta": {"maxPages": 2}},
  {"legacyId": 14, "siteCode": "fanqie", "categoryLegacyId": 14, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/1_2_539", "enabled": 1, "meta": {"maxPages": 2}},
  {"legacyId": 15, "siteCode": "fanqie", "categoryLegacyId": 15, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/1_2_262", "enabled": 1, "meta": {"maxPages": 2}},
  {"legacyId": 16, "siteCode": "fanqie", "categoryLegacyId": 16, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/1_2_751", "enabled": 1, "meta": {"maxPages": 2}},
  {"legacyId": 17, "siteCode": "fanqie", "categoryLegacyId": 17, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/1_2_504", "enabled": 1, "meta": {"maxPages": 2}},
  {"legacyId": 18, "siteCode": "fanqie", "categoryLegacyId": 18, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/1_2_746", "enabled": 1, "meta": {"maxPages": 2}},
  {"legacyId": 19, "siteCode": "fanqie", "categoryLegacyId": 19, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/1_2_718", "enabled": 1, "meta": {"maxPages": 2}},
  {"legacyId": 25, "siteCode": "qimao", "categoryLegacyId": null, "rankType": "hot", "title": "大热榜", "url": "https://www.qimao.com/qimaoapi/api/rank/book-list?is_girl=0&rank_type=1&date_type=1&date=&page=1", "enabled": 1, "meta": {"gender": "male", "maxPages": 5, "metricMode": "value", "metricName": "热度", "scope": "all"}},
  {"legacyId": 26, "siteCode": "fanqie", "categoryLegacyId": 86, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/1_1_1141", "enabled": 1, "meta": {"gender": "male", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 27, "siteCode": "fanqie", "categoryLegacyId": 87, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/1_1_1140", "enabled": 1, "meta": {"gender": "male", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 28, "siteCode": "fanqie", "categoryLegacyId": 88, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/1_1_8", "enabled": 1, "meta": {"gender": "male", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 29, "siteCode": "fanqie", "categoryLegacyId": 89, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/1_1_261", "enabled": 1, "meta": {"gender": "male", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 30, "siteCode": "fanqie", "categoryLegacyId": 90, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/1_1_124", "enabled": 1, "meta": {"gender": "male", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 31, "siteCode": "fanqie", "categoryLegacyId": 91, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/1_1_1014", "enabled": 1, "meta": {"gender": "male", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 32, "siteCode": "fanqie", "categoryLegacyId": 92, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/1_1_273", "enabled": 1, "meta": {"gender": "male", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 33, "siteCode": "fanqie", "categoryLegacyId": 93, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/1_1_27", "enabled": 1, "meta": {"gender": "male", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 34, "siteCode": "fanqie", "categoryLegacyId": 94, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/1_1_263", "enabled": 1, "meta": {"gender": "male", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 35, "siteCode": "fanqie", "categoryLegacyId": 95, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/1_1_258", "enabled": 1, "meta": {"gender": "male", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 36, "siteCode": "fanqie", "categoryLegacyId": 96, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/1_1_272", "enabled": 1, "meta": {"gender": "male", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 37, "siteCode": "fanqie", "categoryLegacyId": 97, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/1_1_539", "enabled": 1, "meta": {"gender": "male", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 38, "siteCode": "fanqie", "categoryLegacyId": 98, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/1_1_262", "enabled": 1, "meta": {"gender": "male", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 39, "siteCode": "fanqie", "categoryLegacyId": 99, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/1_1_257", "enabled": 1, "meta": {"gender": "male", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 40, "siteCode": "fanqie", "categoryLegacyId": 100, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/1_1_751", "enabled": 1, "meta": {"gender": "male", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 41, "siteCode": "fanqie", "categoryLegacyId": 101, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/1_1_504", "enabled": 1, "meta": {"gender": "male", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 42, "siteCode": "fanqie", "categoryLegacyId": 102, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/1_1_746", "enabled": 1, "meta": {"gender": "male", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 43, "siteCode": "fanqie", "categoryLegacyId": 103, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/1_1_718", "enabled": 1, "meta": {"gender": "male", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 44, "siteCode": "fanqie", "categoryLegacyId": 104, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/1_1_1016", "enabled": 1, "meta": {"gender": "male", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 45, "siteCode": "qimao", "categoryLegacyId": null, "rankType": "new", "title": "新书榜", "url": "https://www.qimao.com/qimaoapi/api/rank/book-list?is_girl=0&rank_type=2&date_type=1&date=&page=1", "enabled": 1, "meta": {"gender": "male", "maxPages": 5, "metricMode": "value", "metricName": "热度", "scope": "all"}},
  {"legacyId": 46, "siteCode": "qimao", "categoryLegacyId": null, "rankType": "collect", "title": "收藏榜", "url": "https://www.qimao.com/qimaoapi/api/rank/book-list?is_girl=0&rank_type=4&date_type=1&date=&page=1", "enabled": 1, "meta": {"gender": "male", "maxPages": 5, "metricMode": "none", "scope": "all"}},
  {"legacyId": 48, "siteCode": "fanqie", "categoryLegacyId": 143, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/0_2_1139", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "pageMode": null, "scope": "category"}},
  {"legacyId": 49, "siteCode": "fanqie", "categoryLegacyId": 144, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/0_2_8", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "pageMode": null, "scope": "category"}},
  {"legacyId": 50, "siteCode": "fanqie", "categoryLegacyId": 145, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/0_2_746", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "pageMode": null, "scope": "category"}},
  {"legacyId": 51, "siteCode": "fanqie", "categoryLegacyId": 146, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/0_2_1015", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "pageMode": null, "scope": "category"}},
  {"legacyId": 52, "siteCode": "fanqie", "categoryLegacyId": 147, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/0_2_248", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "pageMode": null, "scope": "category"}},
  {"legacyId": 53, "siteCode": "fanqie", "categoryLegacyId": 148, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/0_2_23", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "pageMode": null, "scope": "category"}},
  {"legacyId": 54, "siteCode": "fanqie", "categoryLegacyId": 149, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/0_2_79", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "pageMode": null, "scope": "category"}},
  {"legacyId": 55, "siteCode": "fanqie", "categoryLegacyId": 150, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/0_2_267", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "pageMode": null, "scope": "category"}},
  {"legacyId": 56, "siteCode": "fanqie", "categoryLegacyId": 151, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/0_2_246", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "pageMode": null, "scope": "category"}},
  {"legacyId": 57, "siteCode": "fanqie", "categoryLegacyId": 152, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/0_2_539", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "pageMode": null, "scope": "category"}},
  {"legacyId": 58, "siteCode": "fanqie", "categoryLegacyId": 153, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/0_2_253", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "pageMode": null, "scope": "category"}},
  {"legacyId": 59, "siteCode": "fanqie", "categoryLegacyId": 154, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/0_2_24", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "pageMode": null, "scope": "category"}},
  {"legacyId": 60, "siteCode": "fanqie", "categoryLegacyId": 155, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/0_2_749", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "pageMode": null, "scope": "category"}},
  {"legacyId": 61, "siteCode": "fanqie", "categoryLegacyId": 156, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/0_2_745", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "pageMode": null, "scope": "category"}},
  {"legacyId": 62, "siteCode": "fanqie", "categoryLegacyId": 157, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/0_2_747", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "pageMode": null, "scope": "category"}},
  {"legacyId": 63, "siteCode": "fanqie", "categoryLegacyId": 158, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/0_2_750", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "pageMode": null, "scope": "category"}},
  {"legacyId": 64, "siteCode": "fanqie", "categoryLegacyId": 159, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/0_2_748", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "pageMode": null, "scope": "category"}},
  {"legacyId": 65, "siteCode": "fanqie", "categoryLegacyId": 160, "rankType": "reading", "title": "阅读榜", "url": "https://fanqienovel.com/rank/0_2_1017", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "pageMode": null, "scope": "category"}},
  {"legacyId": 66, "siteCode": "fanqie", "categoryLegacyId": 161, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/0_1_1139", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 67, "siteCode": "fanqie", "categoryLegacyId": 162, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/0_1_8", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 68, "siteCode": "fanqie", "categoryLegacyId": 163, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/0_1_746", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 69, "siteCode": "fanqie", "categoryLegacyId": 164, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/0_1_1015", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 70, "siteCode": "fanqie", "categoryLegacyId": 165, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/0_1_248", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 71, "siteCode": "fanqie", "categoryLegacyId": 166, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/0_1_23", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 72, "siteCode": "fanqie", "categoryLegacyId": 167, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/0_1_79", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 73, "siteCode": "fanqie", "categoryLegacyId": 168, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/0_1_267", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 74, "siteCode": "fanqie", "categoryLegacyId": 169, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/0_1_246", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 75, "siteCode": "fanqie", "categoryLegacyId": 170, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/0_1_539", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 76, "siteCode": "fanqie", "categoryLegacyId": 171, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/0_1_253", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 77, "siteCode": "fanqie", "categoryLegacyId": 172, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/0_1_24", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 78, "siteCode": "fanqie", "categoryLegacyId": 173, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/0_1_749", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 79, "siteCode": "fanqie", "categoryLegacyId": 174, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/0_1_745", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 80, "siteCode": "fanqie", "categoryLegacyId": 175, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/0_1_747", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 81, "siteCode": "fanqie", "categoryLegacyId": 176, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/0_1_750", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 82, "siteCode": "fanqie", "categoryLegacyId": 177, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/0_1_748", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 83, "siteCode": "fanqie", "categoryLegacyId": 178, "rankType": "new", "title": "新书榜", "url": "https://fanqienovel.com/rank/0_1_1017", "enabled": 1, "meta": {"gender": "female", "maxPages": 2, "metricMode": "value", "metricName": "在读", "pageMode": null, "scope": "category"}},
  {"legacyId": 86, "siteCode": "qimao", "categoryLegacyId": null, "rankType": "hot", "title": "大热榜", "url": "https://www.qimao.com/qimaoapi/api/rank/book-list?is_girl=1&rank_type=1&date_type=1&date=&page=1", "enabled": 1, "meta": {"gender": "female", "maxPages": 5, "metricMode": "value", "metricName": "热度", "scope": "all"}},
  {"legacyId": 87, "siteCode": "qimao", "categoryLegacyId": null, "rankType": "new", "title": "新书榜", "url": "https://www.qimao.com/qimaoapi/api/rank/book-list?is_girl=1&rank_type=2&date_type=1&date=&page=1", "enabled": 1, "meta": {"gender": "female", "maxPages": 5, "metricMode": "value", "metricName": "热度", "scope": "all"}},
]

export interface RankPlatform {
  code: string
  name: string
  baseUrl?: string
}

export interface RankCategoryOption {
  id: number
  code: string
  name: string
}

export const rankPlatformOptions = (): RankPlatform[] =>
  RANK_SITES.map(site => ({ code: site.code, name: site.name, baseUrl: site.baseUrl || undefined }))

export const rankCategoryOptions = (siteCode: string, gender?: string): RankCategoryOption[] =>
  RANK_CATEGORIES.filter(
    category =>
      category.siteCode === siteCode &&
      category.enabled === 1 &&
      category.parentLegacyId === null &&
      (!gender || category.gender === gender)
  )
    .sort((a, b) => a.sortNo - b.sortNo)
    .map(category => ({ id: category.legacyId, code: category.code, name: category.name }))

export const findRankCategory = (legacyId: number | null | undefined) =>
  RANK_CATEGORIES.find(category => category.legacyId === Number(legacyId)) || null

export const findRankCategoryByCode = (code: string | null | undefined) =>
  RANK_CATEGORIES.find(category => category.code === String(code || '').trim()) || null

export const findRankSource = (sourceId: number | string) =>
  RANK_SOURCES.find(source => source.legacyId === Number(sourceId)) || null
