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
]
