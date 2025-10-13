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
      defaultLocale: 'zh',
      locales: [
        { code: 'zh', iso: 'zh-CN', file: 'zh.json', name: '简体中文' },
        { code: 'en', iso: 'en-US', file: 'en.json', name: 'English' }
      ],
      lazy: true,
      langDir: 'locales',
      detectBrowserLanguage: false
    }]
  ],

  app: {
    head: {
      title: 'pgWhite — 好词好句·多维检索',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: '存储并多维检索好词好句（作者/书籍/题材/场景时间/主题/修辞）' }
      ]
    }
  }
})