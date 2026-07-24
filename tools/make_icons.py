#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Win98 桌面网站 — 自绘像素图标生成器（无版权顾虑，可随意使用/修改）

用法：
    python3 tools/make_icons.py            # 生成全部图标到 assets/icons/
    python3 tools/make_icons.py --preview  # 额外生成 tools/preview.png 预览图（8x 放大）

依赖：Pillow（pip install Pillow）
新增图标：在下面写一个 draw_xxx(draw) 函数，并加入 ICONS 列表，重跑即可。
"""
import os
import sys

from PIL import Image, ImageDraw

SIZE = 32
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'icons')

# 调色板
INK = '#1a1a1a'        # 描边
GRAY = '#c0c0c0'       # Win98 经典灰
GRAY_D = '#868a8e'
WHITE = '#ffffff'
TEAL = '#008080'       # 桌面青
TEAL_L = '#2aa8a8'
NAVY = '#000080'
BLUE = '#2a7de1'
BLUE_L = '#bcd8f5'
GREEN = '#3cb54a'
LCD = '#c8e0b8'
LCD_D = '#2a3a2a'
PAPER_L = '#3b6ea5'
BTN = '#d4d0c8'
ORANGE = '#e08040'
AMBER = '#ffa500'
DARK = '#404040'
YELLOW = '#f7d774'
YELLOW_D = '#6b5a1e'


def canvas():
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def save(img, name):
    os.makedirs(OUT_DIR, exist_ok=True)
    img.save(os.path.join(OUT_DIR, name + '.png'))


def draw_computer(d):
    """CRT 显示器"""
    d.rectangle([3, 4, 28, 22], fill=GRAY, outline=INK)
    d.line([4, 5, 27, 5], fill=WHITE)            # 顶部高光
    d.rectangle([6, 7, 25, 19], fill=TEAL)       # 屏幕
    d.line([8, 8, 14, 14], fill=TEAL_L)          # 屏幕斜向反光
    d.line([9, 8, 15, 14], fill=TEAL_L)
    d.point([(24, 21)], fill='#00ff00')          # 电源灯
    d.rectangle([13, 23, 18, 24], fill=GRAY, outline=INK)   # 支架
    d.rectangle([8, 25, 23, 26], fill=GRAY, outline=INK)    # 底座


def draw_notepad(d):
    """便签纸"""
    d.rectangle([8, 2, 24, 29], fill=WHITE, outline=INK)
    # 右上角折角
    d.polygon([(19, 2), (24, 2), (24, 7)], fill=(0, 0, 0, 0))
    d.polygon([(19, 2), (24, 7), (19, 7)], fill='#e8e8e8', outline=INK)
    # 横线
    for i, y in enumerate([9, 13, 17, 21, 25]):
        x2 = 17 if i == 0 else 21
        d.line([11, y, x2, y], fill=PAPER_L)


def draw_calculator(d):
    """计算器"""
    d.rectangle([6, 2, 26, 30], fill='#808080', outline=INK)
    d.line([7, 3, 25, 3], fill=WHITE)
    d.rectangle([9, 5, 23, 10], fill=LCD, outline=DARK)      # 显示屏
    d.line([18, 7, 21, 7], fill=LCD_D)                       # 假数字
    d.line([13, 7, 15, 7], fill=LCD_D)
    for row in range(3):                                     # 按键 3x3
        for col in range(3):
            x, y = 9 + col * 6, 14 + row * 5
            color = ORANGE if (row, col) == (2, 2) else BTN
            d.rectangle([x, y, x + 4, y + 3], fill=color, outline=DARK)


def draw_globe(d):
    """地球（链接/网络）"""
    d.ellipse([4, 4, 28, 28], fill=BLUE)
    d.ellipse([8, 9, 15, 15], fill=GREEN)        # 陆地
    d.ellipse([18, 17, 25, 23], fill=GREEN)
    d.ellipse([16, 6, 20, 9], fill=GREEN)
    d.ellipse([12, 4, 20, 28], outline=BLUE_L)   # 经线
    d.line([5, 16, 27, 16], fill=BLUE_L)         # 赤道
    d.ellipse([8, 7, 12, 10], fill=(255, 255, 255, 90))  # 高光
    d.ellipse([4, 4, 28, 28], outline='#10305a')


def draw_bin(d):
    """回收站"""
    d.rectangle([13, 3, 19, 4], fill=GRAY, outline=INK)     # 提手
    d.rectangle([7, 5, 25, 8], fill='#d0d0d0', outline=INK)  # 盖子
    d.polygon([(8, 9), (24, 9), (22, 28), (10, 28)], fill=GRAY, outline=INK)
    for x in (13, 16, 19):                         # 桶身竖棱
        d.line([x, 11, x - 1 if x < 16 else x + 1, 26], fill=GRAY_D)


def draw_start(d):
    """开始按钮用的小窗口图标：浅蓝窗面，避免融进银色任务栏"""
    d.rectangle([5, 5, 27, 27], fill=BLUE_L, outline=INK)
    d.rectangle([5, 5, 27, 9], fill=NAVY)        # 标题栏
    d.line([16, 12, 16, 25], fill=INK)           # 2x2 窗格
    d.line([7, 17, 25, 17], fill=INK)
    d.point([(8, 13), (9, 13)], fill=TEAL)       # 左上窗格点缀
    d.point([(19, 20), (20, 20)], fill=TEAL)


def draw_shutdown(d):
    """电源符号：浅灰按钮面 + 琥珀符号（深色面在小尺寸下容易糊成一团黑）"""
    d.rectangle([4, 4, 28, 28], fill=BTN, outline=INK)
    d.line([5, 5, 27, 5], fill=WHITE)                        # 顶部高光
    d.arc([9, 7, 23, 21], start=300, end=240, fill='#c05a10', width=4)
    d.arc([9, 7, 23, 21], start=300, end=240, fill=AMBER, width=2)
    d.line([16, 5, 16, 14], fill='#c05a10', width=4)
    d.line([16, 5, 16, 14], fill=AMBER, width=2)


def draw_folder(d):
    """文件夹（我的文档备用）"""
    d.polygon([(4, 26), (4, 8), (8, 8), (10, 6), (16, 6), (18, 8), (28, 8), (28, 26)],
              fill=YELLOW, outline=YELLOW_D)
    d.line([5, 12, 27, 12], fill='#d9a832')
    d.line([5, 9, 27, 9], fill='#ffe9a8')


def draw_mine(d):
    """水雷（扫雷）：黑体 + 浅色描边光晕，保证在青色桌面和银色任务栏上都看得清"""
    c = 16
    dirs = [(0, -1), (0, 1), (-1, 0), (1, 0), (-1, -1), (1, -1), (-1, 1), (1, 1)]
    # 先铺一圈浅色光晕（粗线 + 粗圆描边），再叠深色本体
    for dx, dy in dirs:
        d.line([c, c, c + dx * 11, c + dy * 11], fill='#e8e8e8', width=4)
    d.ellipse([8, 8, 24, 24], outline='#e8e8e8', width=3)
    for dx, dy in dirs:
        d.line([c, c, c + dx * 11, c + dy * 11], fill=INK, width=2)
    d.ellipse([10, 10, 22, 22], fill='#2e2e2e', outline='#000000')
    d.line([12, 12, 15, 15], fill='#7a7a7a', width=2)      # 大高光
    d.point([(13, 12), (14, 12)], fill=WHITE)              # 亮点


def draw_poker(d):
    """扑克牌 + 筹码（德州扑克）"""
    RED = '#c0392b'

    def pip(x, y, rows, color):                  # 5x5 像素花色
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch == '1':
                    d.point([(x + i, y + j)], fill=color)

    HEART = ['01010', '11111', '11111', '01110', '00100']
    SPADE = ['00100', '01110', '11111', '11111', '00100']

    # 底牌（红心，左后）
    d.rectangle([3, 6, 15, 28], fill='#f0f0f0', outline=INK)
    d.line([4, 7, 14, 7], fill=WHITE)            # 顶部高光
    pip(7, 14, HEART, RED)
    # 名牌（黑桃，右前）
    d.rectangle([11, 3, 24, 25], fill=WHITE, outline=INK)
    d.line([12, 4, 23, 4], fill='#e8e8e8')
    pip(15, 9, SPADE, INK)
    d.line([17, 14, 17, 16], fill=INK)           # 黑桃柄
    # 筹码（右下）
    d.ellipse([18, 20, 30, 30], fill=RED, outline=INK)
    d.ellipse([21, 23, 27, 27], fill=WHITE)
    d.ellipse([23, 25, 25, 25], fill=RED)


def draw_exhibit(d):
    """展品画框：金色相框里的流星夜空（展柜 exhibits 入口）"""
    SKY = '#141a33'
    GOLD = '#caa14a'
    GOLD_D = '#8a6a24'
    # 相框
    d.rectangle([4, 5, 27, 24], fill=GOLD, outline=INK)
    d.rectangle([6, 7, 25, 22], fill=GOLD_D)
    d.rectangle([7, 8, 24, 21], fill=SKY)
    # 星星
    d.point([(10, 11)], fill=WHITE)
    d.point([(12, 19)], fill=WHITE)
    d.point([(21, 17)], fill=WHITE)
    d.point([(9, 15)], fill='#8fb8ff')
    # 流星（右上往左下：尾巴 + 亮头）
    d.line([13, 18, 20, 11], fill='#8fb8ff')
    d.line([15, 17, 21, 11], fill='#c9e2ff')
    d.point([(21, 11), (22, 11), (21, 10), (22, 10)], fill=WHITE)
    # 展台小牌
    d.rectangle([11, 26, 20, 29], fill=GRAY, outline=INK)
    d.line([13, 27, 18, 27], fill=WHITE)


def draw_gallery(d):
    """博物馆立面：三角楣 + 立柱 + 台阶（展览馆入口）；藏青大门加强小尺寸对比"""
    GOLD = '#caa14a'
    # 三角楣（中央一颗小星，暗合展品 001）
    d.polygon([(16, 3), (28, 10), (4, 10)], fill='#e8e8e8', outline=INK)
    d.point([(15, 6), (16, 6), (15, 7), (16, 7)], fill=GOLD)
    # 楣梁
    d.rectangle([4, 11, 27, 13], fill=GRAY, outline=INK)
    d.line([5, 12, 26, 12], fill=WHITE)
    # 立柱间的深色内庭（衬出立柱）
    d.rectangle([5, 14, 26, 22], fill='#5a6a7a')
    # 四根立柱
    for x in (5, 11, 17, 23):
        d.rectangle([x, 14, x + 3, 22], fill='#f0f0f0', outline=INK)
        d.line([x + 1, 15, x + 1, 21], fill=GRAY_D)
    # 大门（藏青 + 金门把）
    d.rectangle([13, 16, 18, 22], fill=NAVY, outline=INK)
    d.point([(17, 19)], fill=GOLD)
    # 基座 + 两级台阶
    d.rectangle([3, 23, 28, 25], fill=GRAY, outline=INK)
    d.rectangle([2, 26, 29, 28], fill=GRAY_D, outline=INK)


def draw_saver(d):
    """屏保小显示器：浅灰机身 + 屏幕里的星空流星（屏幕保护程序入口）"""
    SKY = '#12244a'
    d.rectangle([4, 4, 27, 21], fill=GRAY, outline=INK)      # 显示器外框（与电脑图标同款浅色机身）
    d.line([5, 5, 26, 5], fill=WHITE)                        # 顶部高光
    d.rectangle([7, 6, 24, 18], fill=SKY)                    # 屏幕夜空（稍亮，小尺寸下不死黑）
    # 星星
    d.point([(10, 9), (11, 9), (10, 10)], fill=WHITE)
    d.point([(21, 15), (22, 15)], fill=WHITE)
    d.point([(12, 14), (13, 15)], fill='#8fb8ff')
    # 流星（右上往左下：尾巴 + 亮头）
    d.line([14, 14, 20, 8], fill='#8fb8ff', width=2)
    d.line([16, 13, 21, 8], fill='#c9e2ff')
    d.point([(20, 8), (21, 8), (20, 7), (21, 7)], fill=WHITE)
    # 支架 + 底座
    d.rectangle([13, 22, 18, 23], fill=GRAY, outline=INK)
    d.rectangle([9, 24, 22, 26], fill=GRAY, outline=INK)
    d.line([10, 25, 21, 25], fill=WHITE)


ICONS = [
    ('computer', draw_computer),
    ('notepad', draw_notepad),
    ('calculator', draw_calculator),
    ('globe', draw_globe),
    ('bin', draw_bin),
    ('start', draw_start),
    ('shutdown', draw_shutdown),
    ('folder', draw_folder),
    ('mine', draw_mine),
    ('poker', draw_poker),
    ('exhibit', draw_exhibit),
    ('gallery', draw_gallery),
    ('saver', draw_saver),
]


def make_preview(names):
    cols = 5
    rows = (len(names) + cols - 1) // cols
    cell = SIZE * 8
    label_h = 40
    sheet = Image.new('RGB', (cols * cell, rows * (cell + label_h)), TEAL)
    draw = ImageDraw.Draw(sheet)
    for i, name in enumerate(names):
        icon = Image.open(os.path.join(OUT_DIR, name + '.png')).resize(
            (cell, cell), Image.NEAREST)
        x, y = (i % cols) * cell, (i // cols) * (cell + label_h)
        sheet.paste(icon, (x, y), icon)
        draw.text((x + 8, y + cell + 8), name, fill=WHITE)
    path = os.path.join(os.path.dirname(__file__), 'preview.png')
    sheet.save(path)
    print('预览图:', path)


def main():
    names = []
    for name, fn in ICONS:
        img, d = canvas()
        fn(d)
        save(img, name)
        names.append(name)
        print('生成', name + '.png')
    if '--preview' in sys.argv:
        make_preview(names)


if __name__ == '__main__':
    main()
