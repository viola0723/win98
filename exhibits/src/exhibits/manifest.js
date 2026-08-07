// 展品清单（纯数据，配置驱动）：
// 新展品 = src/exhibits/ 加 xxx.vue + 这里加一条记录，App.vue 壳代码零改动。
//   id    必须和 .vue 文件名一致（?ex=id 按文件名动态加载）
//   no    藏品编号（展厅与展品页展示用）
//   title 作品名
//   desc  一句话简介（展厅卡片上展示）
// 未来如需封面图，可加 cover 字段并在 App.vue 大厅卡片里渲染。
export const EXHIBITS = [
  {
    id: 'meteors',
    no: '001',
    title: '流星雨',
    desc: '把一场 2026 年的流星雨，塞进 1998 年的窗口。',
  },
  {
    id: 'earth',
    no: '002',
    title: '蓝色弹珠',
    desc: '1972 年阿波罗 17 号回头看的那一眼，现在转在你的窗口里。',
  },
  {
    id: 'galaxy',
    no: '003',
    title: '亿万星尘',
    desc: '十万颗星尘悬在指尖旋转。你也是星尘，恰好会看星星的那种。',
  },
]
