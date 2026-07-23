# 展品选题表（Inspira UI · 131 组件消化分档）

> 用途：加展品从这里点将，不用每次翻 131 个 demo。描述与难度为**预评估**，以 [inspira-ui.com](https://inspira-ui.com) 的实际 demo 和源码为准（同步于 2026-07，组件会增多，用时再核）。
> 难度：易＝纯 CSS/JS，原生重写或展柜都快；中＝Canvas/SVG 逻辑较多，建议展柜；难＝WebGL/Three/OGL，必须走展柜。
> 已上架：展品 001「流星雨」(meteors ✅)；欢迎窗星空+乱序标题（warp-background / hyper-text 思路原生重写 ✅）。

## 下一批推荐（优先级前五）

1. **snowfall-bg**（易）—— 雪花飘落，屏保/冬季氛围首选，性价比最高
2. **dither-shader**（难）—— 抖动复古 shader，和 Win98 像素气质绝配，值得第一个 WebGL 展品
3. **confetti**（易）—— 彩带，可直接当扫雷/德州胜利彩蛋用，不止做展品
4. **compare**（中）—— 前后对比拖拽滑块，天生适合展示"AI 修改前 vs 修改后"
5. **scratch-to-reveal**（中）—— 刮刮卡，彩蛋圣体：把作品藏在刮层下面

## 一、氛围背景（屏保 .scr / 窗口背景首选）

| 组件 | 是什么 | 难度 |
|---|---|---|
| bg-falling-stars | 流星坠落夜空 | 易 |
| snowfall-bg | 雪花飘落 | 易 |
| particles-bg | 漂浮粒子 | 易 |
| bg-stars | 闪烁星空 | 易 |
| bg-bubbles | 上升气泡 | 易 |
| flickering-grid | 闪烁方格矩阵 | 易 |
| ripple | 水波涟漪扩散 | 易 |
| aurora-background | 极光渐变流动 | 易 |
| warp-background | 星空跃迁（欢迎窗已有同类原生实现） | 中 |
| wavy-background | 波浪线流动 | 中 |
| bg-neural | 神经网络连线 | 中 |
| bg-particle-whirlpool | 粒子漩涡 | 中 |
| bg-thunderstorm | 雷暴闪电 | 中 |
| vortex | 旋涡粒子风暴 | 难 |
| bg-black-hole | 黑洞吸积盘 | 难 |
| liquid-background | 液态流动 | 难 |
| bg-silk | 丝绸光泽流动 | 难 |
| light-speed | 光速隧道穿梭 | 难 |
| cosmic-portal | 宇宙传送门 | 难 |
| dither-shader | 复古抖动 shader | 难 |
| shader-toy | ShaderToy 通用容器（有了它等于有了整个 shadertoy.com） | 难 |

## 二、文字特效（文章页 / 标题点缀）

| 组件 | 是什么 | 难度 |
|---|---|---|
| text-glitch | 故障抖动字 | 易 |
| hyper-text | 乱序解码字（欢迎窗标题已原生实现同类） | 易 |
| flip-words | 单词轮翻 | 易 |
| morphing-text | 文字形变过渡 | 易 |
| colourful-text | 彩色渐变文字 | 易 |
| number-ticker | 数字滚动 | 易 |
| letter-pullup | 字母逐字升起 | 易 |
| sparkles-text | 星光点缀文字 | 易 |
| radiant-text | 光芒渐变字 | 易 |
| line-shadow-text | 线条投影字 | 易 |
| text-highlight | 荧光笔高亮 | 易 |
| spinning-text | 环形旋转字 | 易 |
| container-text-flip | 整词翻转换字 | 易 |
| encrypted-text | 加密→解密显现 | 易 |
| text-generate-effect | 逐字生成 | 易 |
| blur-reveal | 模糊聚焦揭示 | 易 |
| box-reveal | 色块扫过揭示 | 易 |
| text-reveal / text-scroll-reveal | 滚动驱动揭示 | 中 |
| text-hover-effect | 悬停描边填充 | 中 |
| text-reveal-card | 卡片里藏句子 | 中 |
| video-text | 视频填充文字 | 中 |
| text-3d | 立体字 | 中 |
| svg-mask | 遮罩透视字 | 中 |

## 三、按钮与边框点缀（窗口/作品页装饰）

| 组件 | 是什么 | 难度 |
|---|---|---|
| glow-border | 辉光边框 | 易 |
| border-beam | 边框流光 | 易 |
| neon-border | 霓虹边框 | 易 |
| rainbow-button | 彩虹描边按钮 | 易 |
| shimmer-button | 微光扫过按钮 | 易 |
| gradient-button | 渐变按钮 | 易 |
| interactive-hover-button | 悬停交互按钮 | 易 |
| ripple-button | 涟漪按钮 | 易 |
| card-spotlight | 鼠标聚光灯卡片 | 易 |

## 四、画廊与图片（未来图片查看器的"现代芯"）

| 组件 | 是什么 | 难度 |
|---|---|---|
| compare | 前后对比拖拽滑块 | 中 |
| images-slider | 图片滑动切换 | 中 |
| expandable-gallery | 手风琴展开画廊 | 中 |
| photo-gallery | 照片墙 | 中 |
| bending-gallery | 弯曲滚动画廊 | 中 |
| infinite-grid | 无限拖拽网格 | 中 |
| apple-card-carousel | 大卡片轮播 | 中 |
| carousel-3d | 3D 轮播 | 中 |
| card-3d | 3D 倾斜卡 | 中 |
| flip-card | 翻转卡 | 中 |
| book | 3D 翻书 | 中 |
| balance-slider | 平衡对比滑块 | 中 |
| lens | 放大镜 | 中 |

## 五、光标与彩蛋向

| 组件 | 是什么 | 难度 |
|---|---|---|
| confetti | 彩带（胜利/节日彩蛋） | 易 |
| scratch-to-reveal | 刮刮卡 | 中 |
| orbit | 轨道环绕 | 中 |
| animated-beam | 光束连线（适合"友情链接"页） | 中 |
| tracing-beam | 滚动追踪光线 | 中 |
| dock | macOS 程序坞 | 中 |
| marquee | 跑马灯 | 易 |
| multi-step-loader | 分步加载动画 | 易 |
| animated-circular-progressbar | 环形进度条 | 易 |
| timeline | 时间轴（可做"作品编年史"页） | 中 |
| lamp-effect | 台灯照亮揭示 | 中 |
| direction-aware-hover | 方向感知悬停 | 中 |
| image-trail-cursor | 图片拖尾光标 | 中 |
| smooth-cursor / tailed-cursor / sleek-line-cursor | 自定义光标 | 中 |
| fluid-cursor | WebGL 流体光标 | 难 |

## 六、3D / 镇站级（展柜的天花板）

| 组件 | 是什么 | 难度 |
|---|---|---|
| globe | 点阵地球仪 | 难 |
| github-globe | 带连线的地球仪 | 难 |
| icon-cloud | 3D 图标云 | 难 |
| spline | Spline 3D 场景嵌入 | 难 |
| tetris | 俄罗斯方块堆叠动画 | 中 |

## 七、暂不考虑

- 评价/营销类：animated-testimonials、testimonial-slider、design-testimonials、logo-cloud（个人站用不上）
- 设备框：iphone-mockup、safari-mockup（和 98 窗框气质冲突）
- 表单工具：input、vanishing-input、file-upload、color-picker、halo-search、file-tree
- 长页布局类：bento-grid、container-scroll、scroll-island、progressive-blur、link-preview、spring-calendar（更适合官网首页而非窗口）
- 本表未列全的组件，以官网组件目录为准查漏补缺

## 待办（下次找时间做）

- [x] ~~inspira-ui 组件源本地镜像~~（2026-07-23 完成：浅克隆于 `../tools/inspira-ui`，组件源在 `app/components/inspira/ui/<组件名>/`，示例在 `.../examples/`）
- [x] ~~官方 CLI 是否支持纯 Vite~~（2026-07-23 验证结论：**支持，但不推荐在本项目用**——官方 CLI 即 shadcn-vue CLI + inspira registry：`npx shadcn-vue@latest add "https://inspira-ui.com/r/<组件>.json"`，registry 实测可用，shadcn-vue 官方有 Vite 安装指南；但 CLI 会按 shadcn 体系引入 components.json、`@inspira-ui/plugins`（组件内 `cn` 从它导入）等一整套依赖与配置，与本项目轻量路线不符，继续从本地镜像手工拷贝 + 改用 `src/lib/utils` 的 cn）
- [x] ~~展品页 `?ex=` 参数路由~~（2026-07-23 完成：App.vue 用 `import.meta.glob('./exhibits/*.vue')` 按 `?ex=` 动态加载，新展品只加 `src/exhibits/xxx.vue` + rebuild，壳零改动；无参/未知参数自动列出全部展品入口）
