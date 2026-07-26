// ==============================
// File: nuxt.config.ts
// 标题：Nuxt 基础配置（严格 TS / 模块 / 主题与 i18n）
// ==============================
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  typescript: { strict: true },
  css: ['./styles/theme.css'],

  // @nuxt/ui 默认会拉 Google Fonts / Material Icons 元数据，国内常超时重试导致 dev 很慢
  ui: {
    fonts: false
  },

  modules: [
    '@nuxt/ui',
    // 把 i18n 配置写到模块数组里（这一项是 [模块名, 配置对象] 的二元组）
    ['@nuxtjs/i18n', {
      strategy: 'no_prefix',
      defaultLocale: 'zh',
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

  runtimeConfig: {
    dbHost: process.env.DB_HOST,
    dbPort: process.env.DB_PORT,
    dbUser: process.env.DB_USER,
    dbPassword: process.env.DB_PASSWORD,
    dbName: process.env.DB_NAME,
    /** quote_translations.language_code（你当前为 zh / en） */
    dbLangZh: process.env.DB_LANG_ZH || 'zh',
    dbLangEn: process.env.DB_LANG_EN || 'en',
    /** tags 表「种类」列名（第二列），默认 kind */
    tagKindColumn: process.env.TAG_KIND_COLUMN || 'source_code',
    /** 种类数值：场景时间 / 主题 / 修辞 — 对应你库里的 1、2、3（顺序可用环境变量改） */
    tagKindTime: process.env.TAG_KIND_TIME || '1',
    tagKindTheme: process.env.TAG_KIND_THEME || '2',
    tagKindDevice: process.env.TAG_KIND_DEVICE || '3'
  },
  
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