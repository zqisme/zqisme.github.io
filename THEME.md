# 前端主题说明（2026-11）

这是对 Narcissu 博客前端的一次整体优化。核心原因是：原站点唯一的样式表依赖
`sustech.edu.cn` 镜像上的 Primer CSS，而该请求会被浏览器以 `ERR_BLOCKED_BY_ORB`
拦截，整站因此退化为无样式列表；该文件本身也高达 832 KB。

现在站点使用**自托管**的 `assets/site.css`（约 31 KB）和 `assets/site.js`（约 20 KB），
不再依赖任何外部 CSS/字体，离线/被墙环境也能正常显示。

## 改了什么

### 1. 视觉与排版

- 去掉 Primer 与 starry-night 两个外部样式依赖，改为一份轻量主题。
- 亮色 / 暗色 / 跟随系统三种模式；主题在 CSS 加载前由内联脚本应用，避免闪烁。
- 更适合中文长文的字体栈、行高（1.86）、段落间距与标题层级。
- 列表页显示文章摘要、日期、标签色点；摘要由构建脚本从正文首段生成，已清理 Markdown。
- 移动端重新排版：标题、摘要、日期分层；隐藏顶部 RSS 图标避免拥挤。

### 2. 阅读体验

- 文章页展示日期、标签、阅读时长（`约 N 分钟`）。
- 长文自动生成可折叠目录（≥3 个 h2/h3），滚动高亮当前章节。
- 标题悬停出现 `#` 锚点，可复制单节链接。
- 代码块复制按钮（含无语言高亮的普通代码块）。
- 图片懒加载 + 点击放大灯箱（Esc 关闭），表格自动横向滚动。
- 上一篇 / 下一篇导航；顶部阅读进度条；右下角回到顶部。

### 3. 归档与搜索

- `tag.html` 重做为「归档」：标签筛选 + 标题/正文全文搜索 + 命中片段高亮。
- 搜索索引 `search-index.json` 在构建时生成，仅在输入时懒加载。
- 支持 `tag.html#笔记` 深链；按 `/` 聚焦搜索框，Esc 清空。
- 页面标记 `noindex`，避免搜索页被搜索引擎收录。

### 4. SEO

- 每页 canonical、`og:*`、`twitter:*`；文章页补 `article:published_time` 与 JSON-LD。
- 首页 JSON-LD `WebSite`，文章页 JSON-LD `BlogPosting`（作者、日期、分区）。
- RSS 自动发现 `<link rel="alternate">`（不再依赖 docs 手工改动）。
- 构建时生成 `sitemap.xml`、`search-index.json`；`static/robots.txt` 指向 sitemap。
- 新增 `404.html`（GitHub Pages 会自动使用根目录的 404 页面）。

### 5. 构建流程

- `.github/workflows/Gmeek.yml`
  - `push` 触发路径增加 `templates/**`、`tools/**`、workflow 自身，改主题即重建。
  - 生成后运行 `node tools/seo.mjs`。
  - 修复 `cp -a docs $WORKSPACE` 在目标 `docs/` 已存在时可能嵌套成 `docs/docs` 的问题，
    改用 `rsync -a --delete`。
- `config.json`：`primerCSS` 置空；Vercount 脚本改为 `defer`。

## 文件结构

```
templates/            # 覆盖 Gmeek v2.25 的 Jinja2 模板
  base.html           # 布局、主题、SEO 公共部分
  plist.html          # 首页与分页
  post.html           # 文章页 / 单页
  tag.html            # 归档 + 搜索
  footer.html         # 页脚
static/
  assets/site.css     # 主题样式（Gmeek 的 static/ 会复制到站点根，因此 URL 为 /assets/...）
  assets/site.js      # 阅读体验与归档搜索脚本
  404.html            # 自定义 404
  robots.txt
tools/
  seo.mjs             # 构建后处理：文章 meta/JSON-LD、摘要清洗、sitemap、搜索索引
THEME.md
```

## 上线步骤

1. 提交并推送本分支（改动 `config.json` 会触发一次**全量**重建）。
2. 到 Actions 确认 `build Gmeek` 成功；首次全量重建会把所有旧文章换成新模板。
3. 打开站点验证：首页、任选一篇文章、`/tag.html`、`/404`（随便输一个不存在的地址）。
4. 可选：把 `https://zqisme.github.io/sitemap.xml` 提交到 Google Search Console / Bing。
5. 可选：在 Google Rich Results Test 里检查一篇文章的 JSON-LD。

> 增量构建（issue 编辑/打标签）只会重渲染当前这篇 + 首页/归档；若只想刷新某篇，
> 也可以在 Actions 里 `workflow_dispatch` 填 issue 编号。

## 维护注意

- **不要直接改 `docs/`**：它是构建产物，下一次 Action 会整体覆盖。
- `templates/` 覆盖的是 Gmeek **v2.25** 的模板。升级 `GMEEK_VERSION` 前，先对比上游
  `templates/` 是否新增了变量/结构，否则升级后可能少渲染内容。
- Gmeek 会把 `static/` 下的内容直接复制到 `docs/` 根目录（子目录原样保留），
  所以样式 URL 是 `/assets/site.css`，而不是 `/static/...`。
- 改域名时同步改 `static/robots.txt` 里的 sitemap 地址；`sitemap.xml` 会自动跟随 `config.json` 的 `homeUrl`。
- `tools/seo.mjs` 会给 `site.css` / `site.js` 自动追加内容指纹（`?v=xxxxxxxx`），改样式后无需手动清缓存。
- `templates/base.html` 中的 `ICON` 是内联 SVG 路径表，增删图标时改这里即可，不再依赖 Gmeek 按页传入的 `IconList`。
- 文章摘要来自构建后的正文首段；纯图片文章可能没有摘要，这是预期行为。