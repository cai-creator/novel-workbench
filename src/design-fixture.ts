import type { ProjectData } from './storage'

/** 只在开发环境 ?ui-preview=1 使用；不会写入读者的本地作品。 */
export function designFixture(): ProjectData {
  return {
    version: 1,
    model: { baseUrl: '', model: '', apiKey: '' },
    books: [{
      id: 'design-book',
      title: '夜行者档案',
      premise: '一座城市会在午夜交换居民的记忆，守夜人林澈发现自己的妹妹从所有人的记忆中消失了。',
      updatedAt: '2026-09-20T00:00:00.000Z',
      chapters: [
        {
          id: 'design-chapter-1',
          title: '第一章 午夜之后',
          content: '凌晨零点，城市的钟声敲了十三下。\n\n林澈停在便利店门口，手里的热咖啡忽然凉了。街对面的人群仍在走动，仿佛谁都没有听见多出来的那一声。只有他看见，路灯下那个穿红雨衣的女孩抬起头，朝他做了个噤声的手势。\n\n下一秒，手机亮起。一条没有署名的短信写着：别回家。你妹妹已经不在那里了。\n\n他拨出那个熟悉的号码。提示音响了很久，接通的人却问：“你找谁？”',
          updatedAt: '2026-09-20T00:00:00.000Z',
          history: [{ id: 'design-version-1', title: '第一章 午夜之后', content: '凌晨零点，城市的钟声敲了十二下。\n\n林澈停在便利店门口，手里的咖啡凉了。街对面的人群仍在走动，仿佛谁都没有听见钟声。路灯下那个穿红雨衣的女孩抬起头，朝他做了个噤声的手势。\n\n手机亮起。一条短信写着：别回家。\n\n他拨出那个熟悉的号码。提示音响了很久，接通的人却问：“你找谁？”', savedAt: '2026-09-19T22:30:00.000Z', source: 'manual' }],
        },
        { id: 'design-chapter-2', title: '第二章 被抹去的名字', outline: '林澈回到家，发现妹妹的所有痕迹都被抹去；一张旧合照却留下了她的影子。结尾有人在门外喊出她的名字。', content: '门锁只转了半圈就开了。\n\n玄关的灯亮着，鞋柜上摆着两双拖鞋，一双是他的，另一双也是他的。', updatedAt: '2026-09-20T00:00:00.000Z', proseCandidates: [
          { id: 'design-candidate-1', kind: 'rewrite', content: '林澈把钥匙插进锁孔，门从里面轻轻弹开。\n\n客厅的灯亮着。母亲坐在餐桌旁，正把两副碗筷往桌上摆。林澈盯着那张桌子，数了一遍，又数了一遍。以前这里总有第三只杯子，杯沿缺了一小块，是小雨摔过的。\n\n“你在找什么？”母亲问。\n\n林澈没有回答。他走进妹妹的房间。墙上没有海报，书架空了，床头却留着一道浅浅的灰痕，像有东西刚被人拿走。\n\n他翻出抽屉里的旧相册。合照上只站着他和母亲，可照片右下角，一只小小的手正攥着他的衣角。', instruction: '用细节表现妹妹被抹去，结尾保留悬念。', createdAt: '2026-09-20T00:10:00.000Z', baseUpdatedAt: '2026-09-20T00:00:00.000Z' },
          { id: 'design-candidate-2', kind: 'continue', content: '林澈没有脱鞋。他顺着走廊往里看，妹妹房门原来的位置，竟多了一面墙。\n\n墙漆还没干透，空气里有一股刺鼻的味道。他伸手摸过去，指尖沾上一点白。墙的另一边，像有什么东西轻轻敲了两下。', instruction: '从门口的异常继续写，节奏紧一点。', createdAt: '2026-09-20T00:08:00.000Z', baseUpdatedAt: '2026-09-20T00:00:00.000Z' },
        ] },
        { id: 'design-chapter-3', title: '第三章 红雨衣', content: '', updatedAt: '2026-09-20T00:00:00.000Z' },
        { id: 'design-chapter-4', title: '第四章 守夜人的规矩', content: '', updatedAt: '2026-09-20T00:00:00.000Z' },
      ],
      lore: [
        { id: 'design-lore-1', title: '午夜交换', mode: 'world', content: '每天午夜，城市会随机交换两个人关于同一件事的记忆。交换不可逆，但保留纸质记录的人可以发现差异。' },
        { id: 'design-lore-2', title: '林澈', mode: 'character', content: '二十七岁，城市夜班档案员。害怕遗忘，却必须不断用自己的记忆换取线索。' },
        { id: 'design-lore-4', title: '第十三声钟响', mode: 'timeline', timeLabel: '第一卷 · 第一天 00:00', content: '林澈听见城市时钟敲了十三下，并收到关于妹妹失踪的匿名短信。' },
        { id: 'design-lore-3', title: '第一卷目标', mode: 'plot', content: '林澈追查妹妹消失的原因，最终发现记忆交换由守夜人主动维持。' },
      ],
      chat: [
        { id: 'design-user', role: 'user', mode: 'prose', chapterId: 'design-chapter-1', content: '接着写他推开家门后的场景。用细节表现“不对劲”，不要直接解释真相。' },
        { id: 'design-ai', role: 'assistant', mode: 'prose', chapterId: 'design-chapter-1', content: '门锁只转了半圈就开了。\n\n玄关的灯亮着，鞋柜上摆着两双拖鞋，一双是他的，另一双也是他的。林澈弯下腰，手指摸到鞋柜侧面那道铅笔刻痕：小雨，十四岁。\n\n刻痕还在。可他抬头时，客厅里传来母亲的声音：“你怎么又把妹妹的名字写在柜子上？”' },
      ],
    }],
  }
}
