// ==============================
// File: nuxt.config.ts
// 标题：Nuxt 基础配置（严格 TS / 模块 / 主题与 i18n）
// ==============================
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  typescript: { strict: true },
  css: ['./styles/theme.css'],

  modules: [
    '@nuxt/ui',
    // 把 i18n 配置写到模块数组里（这一项是 [模块名, 配置对象] 的二元组）
    ['@nuxtjs/i18n', {
      strategy: 'no_prefix',
      defaultLocale: 'en',
      locales: [
        { code: 'zh', iso: 'zh-CN', file: 'zh.json', name: '简体中文' },
        { code: 'en', iso: 'en-US', file: 'en.json', name: 'English' }
      ],
      lazy: true,
      langDir: 'locales',
      detectBrowserLanguage: false,
      preload: ['zh', 'en'],
      compilation: {
        strictMessage: false
      }
    }]
  ],

  app: {
    head: {
      title: 'pgWhite — 好词好句·多维检索',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: '存储并多维检索好词好句（作者/书籍/题材/场景时间/主题/修辞）' }
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg', sizes: 'any' },
        { rel: 'apple-touch-icon', href: '/logo.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Merriweather:wght@300;400;700&family=Noto+Serif+SC:wght@300;400;700&display=swap' }
      ],
      // Plan B：不作为 Nuxt 模块加载，而是直接通过 <script> 注入（仅在 Vercel 环境注入，避免本地 404）
      script: process.env.VERCEL
        ? [
            { src: '/_vercel/insights/script.js', defer: true }
          ]
        : [],
    }
  }
})