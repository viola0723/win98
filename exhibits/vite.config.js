import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// 产物用相对路径（base: './'），保证任意子目录（GitHub Pages 项目页）下可跑
export default defineConfig({
  base: './',
  plugins: [vue(), tailwindcss()],
})
