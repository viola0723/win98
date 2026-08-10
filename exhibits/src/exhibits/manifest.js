// 展品清单（纯数据，配置驱动）：
// 新展品 = src/exhibits/ 加 xxx.vue + 这里加一条记录，App.vue 壳代码零改动。
//   id    必须和 .vue 文件名一致（?ex=id 按文件名动态加载）
//   no    藏品编号（存档/未来档案对话框用，大厅无字不展示）
//   title 作品名（浏览器标签与无障碍 alt 用，大厅无字不展示）
//   desc  一句话简介（存档用，大厅无字不展示）
//   cover 大厅画框封面图（public/covers/ 下的相对路径，4:3，静态画 ↔ 进去动态特效）
export const EXHIBITS = [
  {
    id: 'meteors',
    no: '001',
    title: '流星雨',
    desc: '把一场 2026 年的流星雨，塞进 1998 年的窗口。',
    cover: 'covers/meteors.jpg',
  },
  {
    id: 'earth',
    no: '002',
    title: '蓝色弹珠',
    desc: '1972 年阿波罗 17 号回头看的那一眼，现在转在你的窗口里。',
    cover: 'covers/earth.jpg',
  },
  {
    id: 'galaxy',
    no: '003',
    title: '亿万星尘',
    desc: '十万颗星尘悬在指尖旋转。你也是星尘，恰好会看星星的那种。',
    cover: 'covers/galaxy.jpg',
  },
  {
    id: 'brickphone',
    no: '004',
    title: '大哥大',
    desc: '1983 年的移动自由，一块能打电话的砖头。',
    cover: 'covers/brickphone.jpg',
  },
  {
    id: 'cloudbridge',
    no: '005',
    title: '云桥',
    desc: '云上长桥通天宫，看云的人在桥上站成了一幅画。',
    cover: 'covers/cloudbridge.jpg',
  },
  {
    id: 'sheath',
    no: '006',
    title: '归鞘',
    desc: '竹林剑舞的最后一息，袖落，剑沉，人定。',
    cover: 'covers/sheath.jpg',
  },
]
