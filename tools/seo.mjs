#!/usr/bin/env node
/**
 * 构建后处理：为生成的文章补 SEO 信息，并产出 sitemap.xml 与全文搜索索引。
 *
 * 用法（在仓库根目录）：
 *   node tools/seo.mjs                        # 默认读 blogBase.json，写 docs/
 *   node tools/seo.mjs --out _work/preview    # 本地预览目录
 *
 * 之所以放在 Gmeek 生成之后，是因为 Gmeek 的模板上下文里没有
 * 单篇文章的 createdAt / labels，只能在 HTML 产物上补。
 * 脚本可重复执行：先移除上次注入的 seo:start…seo:end 区块。
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";

const args = process.argv.slice(2);
function arg(name, fallback) {
    const at = args.indexOf("--" + name);
    return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
}

const root = process.cwd();
const blogBasePath = path.resolve(root, arg("blogbase", "blogBase.json"));
const outDir = path.resolve(root, arg("out", "docs"));
const homeOverride = arg("home", "");

if (!fs.existsSync(blogBasePath)) {
    console.error(`[seo] 找不到 ${blogBasePath}，跳过。`);
    process.exit(0);
}

const blog = JSON.parse(fs.readFileSync(blogBasePath, "utf8"));
const homeUrl = String(homeOverride || blog.homeUrl || "").replace(/\/+$/, "");
const siteTitle = blog.title || "Blog";
const siteDesc = blog.subTitle || "";
const lang = blog.i18n === "RU" ? "ru" : blog.i18n === "CN" ? "zh-CN" : "en";
const labels = blog.labelColorDict || {};

function esc(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function decodeEntities(text) {
    const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–", middot: "·" };
    return text
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)))
        .replace(/&([a-z]+);/gi, (match, name) => (name.toLowerCase() in named ? named[name.toLowerCase()] : match));
}

function textOf(html) {
    const withoutScripts = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
        .replace(/<[^>]+>/g, " ");
    return decodeEntities(withoutScripts).replace(/\s+/g, " ").trim();
}

// Gmeek 的 description 直接取自 issue 正文首句，未去掉 Markdown 语法。
// 列表页展示与 meta description 都需要一份干净的摘要。
function truncate(value, limit) {
    const text = String(value || "").trim();
    if (text.length <= limit) { return text; }
    return text.slice(0, limit).replace(/[\s，。；、,.;:：]+$/, "") + "…";
}

function cleanDescription(text) {
    let value = decodeEntities(String(text == null ? "" : text));
    value = value
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/!\[[^\]]*\]\((?:[^)]*)\)/g, " ")
        .replace(/\[([^\]]+)\]\((?:[^)]*)\)/g, "$1")
        .replace(/<[^>]+>/g, " ")
        .replace(/^[\s>]*#{1,6}\s+/gm, "")
        .replace(/[*_~]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    return truncate(value, 118);
}

// 从渲染后的正文里取第一段像样的文字，比原始 description 更适合当摘要
function firstParagraphText(bodyHtml) {
    const paragraphs = [...bodyHtml.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)];
    for (const match of paragraphs) {
        const text = textOf(match[1]).replace(/^[\s\-–—·•]+/, "").trim();
        if (text.replace(/\s/g, "").length >= 24) { return truncate(text, 112); }
    }
    return "";
}

function isoOf(seconds) {
    if (!seconds) { return ""; }
    const date = new Date(Number(seconds) * 1000);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function postMetaHtml(entry) {
    const iso = isoOf(entry.createdAt);
    const date = entry.createdDate || iso.slice(0, 10);
    let html = `<time datetime="${esc(date)}">${esc(String(date).replace(/-/g, "."))}</time>`;
    (entry.labels || []).forEach((label) => {
        const color = labels[label] || "#a43b50";
        html += `<a class="tag" style="--tag-color:${esc(color)}" href="${esc(homeUrl)}/tag.html#${encodeURIComponent(label)}">${esc(label)}</a>`;
    });
    return html;
}

function jsonLd(entry, url, excerpt) {
    const published = isoOf(entry.createdAt);
    const data = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: entry.postTitle,
        description: excerpt || siteDesc,
        url,
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        image: entry.ogImage || blog.avatarUrl,
        datePublished: published,
        dateModified: published,
        inLanguage: lang,
        author: { "@type": "Person", name: siteTitle, url: homeUrl + "/" },
        publisher: { "@type": "Person", name: siteTitle },
        articleSection: (entry.labels || [])[0] || undefined
    };
    return JSON.stringify(data).replace(/</g, "\\u003c");
}

function injectSeo(file, entry) {
    if (!fs.existsSync(file)) { return null; }
    let html = fs.readFileSync(file, "utf8");
    const url = homeUrl + "/" + entry.postUrl;

    html = html.replace(/<!-- seo:start -->[\s\S]*?<!-- seo:end -->/g, "");

    const start = html.indexOf('id="postBody"');
    if (start < 0) { return null; }
    const bodyStart = html.indexOf(">", start) + 1;
    const end = (() => {
        const marker = html.indexOf("<!-- post-body-end", start);
        return marker >= 0 ? marker : html.indexOf('<nav class="post-nav"', start);
    })();
    const bodyHtml = html.slice(bodyStart, end < 0 ? html.length : end);
    const bodyText = textOf(bodyHtml);
    const cleanedFallback = cleanDescription(entry.description);
    const fallbackUsable = cleanedFallback && !/https?:\/\/|\.(?:webp|png|jpe?g|gif)\b/i.test(cleanedFallback);
    const excerpt = firstParagraphText(bodyHtml) || (fallbackUsable ? cleanedFallback : "") || siteDesc + "。";

    const block = `<!-- seo:start -->\n` +
        `<meta property="article:published_time" content="${esc(isoOf(entry.createdAt))}">\n` +
        `<meta property="article:modified_time" content="${esc(isoOf(entry.createdAt))}">\n` +
        `<script type="application/ld+json">${jsonLd(entry, url, excerpt)}</script>\n` +
        `<!-- seo:end -->\n`;
    html = html.replace("</head>", block + "</head>");

    // 摘要里可能带 Markdown / HTML，先清洗再写入 meta
    html = html.replace(/(<meta name="description" content=")[^"]*(")/, (_, open, close) => open + esc(excerpt) + close);
    html = html.replace(/(<meta property="og:description" content=")[^"]*(")/, (_, open, close) => open + esc(excerpt) + close);
    html = html.replace(/(<meta name="twitter:description" content=")[^"]*(")/, (_, open, close) => open + esc(excerpt) + close);

    html = html.replace(
        /(<div class="post-meta" id="postMeta"[^>]*>)([\s\S]*?)(<\/div>)/,
        (_, open, _inner, close) => open + postMetaHtml(entry) + close
    );

    fs.writeFileSync(file, html, "utf8");
    return { u: entry.postUrl, t: entry.postTitle, d: excerpt, e: excerpt === siteDesc + "。" ? "" : excerpt, l: entry.labels || [], s: entry.createdAt, x: bodyText.slice(0, 6000) };
}

const entries = []
    .concat(Object.values(blog.postListJson || {}))
    .concat(Object.values(blog.singeListJson || {}));

const searchIndex = [];
const urls = [];
const excerptByUrl = {};
const now = new Date().toISOString();

for (const entry of entries) {
    if (!entry || !entry.htmlDir) { continue; }
    const file = path.join(outDir, entry.htmlDir.replace(/^docs[\\/]/, ""));
    const record = injectSeo(file, entry);
    if (!record) { continue; }
    searchIndex.push(record);
    excerptByUrl[entry.postUrl] = record.e;
    urls.push({ loc: homeUrl + "/" + entry.postUrl, lastmod: isoOf(entry.createdAt) || now });
}

// 首页与分页页：用正文首段替换 Gmeek 塞进来的原始 Markdown 摘要
for (const name of fs.existsSync(outDir) ? fs.readdirSync(outDir) : []) {
    if (!/^(index|page\d+)\.html$/.test(name)) { continue; }
    const file = path.join(outDir, name);
    let html = fs.readFileSync(file, "utf8");
    html = html.replace(/<li class="post-item">[\s\S]*?<\/li>/g, (block) => {
        const matched = block.match(/class="post-link" href="([^"]+)"/);
        const excerpt = matched ? excerptByUrl[matched[1]] : "";
        if (!excerpt) {
            return block.replace(/<p class="post-excerpt">[\s\S]*?<\/p>/g, "");
        }
        if (/<p class="post-excerpt">/.test(block)) {
            return block.replace(/<p class="post-excerpt">[\s\S]*?<\/p>/, `<p class="post-excerpt">${esc(excerpt)}</p>`);
        }
        return block.replace(/<\/h3>/, `</h3><p class="post-excerpt">${esc(excerpt)}</p>`);
    });
    const pageMatch = name.match(/^page(\d+)\.html$/);
    if (pageMatch) {
        const pageUrl = homeUrl + "/" + name;
        const pageTitle = `${siteTitle} · 第 ${pageMatch[1]} 页`;
        html = html.replace(/(<title>)[\s\S]*?(<\/title>)/, (_, open, close) => open + esc(pageTitle) + close);
        html = html.replace(/(<meta property="og:title" content=")[^"]*(")/, (_, open, close) => open + esc(pageTitle) + close);
        html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, (_, open, close) => open + esc(pageUrl) + close);
        html = html.replace(/(<meta property="og:url" content=")[^"]*(")/, (_, open, close) => open + esc(pageUrl) + close);
    }
    fs.writeFileSync(file, html, "utf8");
}

// 首页分页
const pages = fs.existsSync(outDir)
    ? fs.readdirSync(outDir).filter((name) => /^page\d+\.html$/.test(name)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
    : [];
urls.unshift({ loc: homeUrl + "/", lastmod: now });
pages.forEach((name) => urls.push({ loc: homeUrl + "/" + name, lastmod: now }));

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((item) => `  <url><loc>${esc(item.loc)}</loc><lastmod>${item.lastmod}</lastmod></url>`).join("\n") +
    `\n</urlset>\n`;
fs.writeFileSync(path.join(outDir, "sitemap.xml"), sitemap, "utf8");

// 网站级结构化数据 + 首页 RSS 自动发现（模板里已有，这里仅补 JSON-LD）
const homeFile = path.join(outDir, "index.html");
if (fs.existsSync(homeFile)) {
    let home = fs.readFileSync(homeFile, "utf8");
    home = home.replace(/<!-- seo:site -->[\s\S]*?<!-- seo:site-end -->/g, "");
    const website = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: siteTitle,
        url: homeUrl + "/",
        description: siteDesc,
        inLanguage: lang
    };
    const block = `<!-- seo:site -->\n<script type="application/ld+json">${JSON.stringify(website).replace(/</g, "\\u003c")}</script>\n<!-- seo:site-end -->\n`;
    fs.writeFileSync(homeFile, home.replace("</head>", block + "</head>"), "utf8");
}

fs.writeFileSync(path.join(outDir, "search-index.json"), JSON.stringify(searchIndex), "utf8");

// 给 CSS/JS 加内容指纹，避免 GitHub Pages 的短缓存把旧样式配到新 HTML 上
function versionAssets() {
    const parts = [];
    for (const name of ["assets/site.css", "assets/site.js"]) {
        const file = path.join(outDir, name);
        if (fs.existsSync(file)) { parts.push(fs.readFileSync(file)); }
    }
    if (!parts.length) { return; }
    const hash = crypto.createHash("sha1").update(Buffer.concat(parts)).digest("hex").slice(0, 8);

    const files = [];
    for (const name of fs.readdirSync(outDir)) {
        if (name.endsWith(".html")) { files.push(path.join(outDir, name)); }
    }
    const postDir = path.join(outDir, "post");
    if (fs.existsSync(postDir)) {
        for (const name of fs.readdirSync(postDir)) {
            if (name.endsWith(".html")) { files.push(path.join(postDir, name)); }
        }
    }
    for (const file of files) {
        const html = fs.readFileSync(file, "utf8");
        const next = html.replace(/(\/assets\/site\.(?:css|js))(?:\?v=[0-9a-f]+)?/g, `$1?v=${hash}`);
        if (next !== html) { fs.writeFileSync(file, next, "utf8"); }
    }
}
versionAssets();

console.log(`[seo] 处理 ${searchIndex.length} 篇文章，sitemap ${urls.length} 条 URL。`);