// inspira-ui 组件通用的 cn()：合并 class 并解决 Tailwind 类冲突
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
