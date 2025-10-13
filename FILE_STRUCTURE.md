# pgWhite 项目文件结构树

```
pgwhite/
├── 📁 app/                          # Nuxt 应用根目录
│   └── app.vue                      # 应用主入口文件
├── 📁 components/                   # Vue 组件目录
│   ├── 📁 filters/                  # 筛选器组件
│   │   ├── AuthorFilter.vue         # 作者筛选器
│   │   ├── BookFilter.vue           # 书籍筛选器
│   │   └── TopicFilter.vue          # 主题筛选器
│   ├── LanguageSwitcher.vue         # 语言切换器
│   ├── NoticeBar.vue                # 通知栏组件
│   ├── ResultCard.vue               # 结果卡片组件
│   └── TopBar.vue                   # 顶部导航栏
├── 📁 composables/                  # Vue 组合式函数
│   ├── useFacets.ts                 # 分面搜索逻辑
│   └── useSearch.ts                 # 搜索功能逻辑
├── 📁 data/                         # 静态数据文件
│   ├── authors.json                 # 作者数据
│   ├── books.json                   # 书籍数据
│   ├── sentences.json               # 句子数据
│   └── topics.json                  # 主题数据
├── 📁 i18n/                         # 国际化配置
│   └── 📁 locales/                  # 语言包目录
│       ├── en.json                  # 英文语言包
│       └── zh.json                  # 中文语言包
├── 📁 pages/                        # 页面路由
│   └── index.vue                    # 首页
├── 📁 public/                       # 静态资源
│   ├── favicon.ico                  # 网站图标
│   └── robots.txt                   # 搜索引擎爬虫规则
├── 📁 styles/                       # 样式文件
│   └── theme.css                    # 主题样式
├── 📁 tests/                        # 测试文件
│   ├── 📁 e2e/                      # 端到端测试
│   │   └── main.spec.ts             # 主测试文件
│   └── 📁 unit/                     # 单元测试
│       ├── facets.test.ts           # 分面功能测试
│       └── search.test.ts           # 搜索功能测试
├── 📁 node_modules/                 # 依赖包目录
├── .gitignore                       # Git 忽略文件配置
├── nuxt.config.ts                   # Nuxt 配置文件
├── package.json                     # 项目依赖和脚本配置
├── pnpm-lock.yaml                   # pnpm 锁定文件
├── README.md                        # 项目说明文档
└── tsconfig.json                    # TypeScript 配置
```
