/* Narcissu 站点脚本：无依赖，负责阅读体验与归档搜索 */
(function () {
    "use strict";

    var SITE = window.SITE || {};
    var base = String(SITE.homeUrl || "").replace(/\/+$/, "");
    var page = document.body ? document.body.dataset.page : "home";

    function $(sel, root) { return (root || document).querySelector(sel); }
    function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
    function esc(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
    function fmtDate(iso) { return String(iso || "").replace(/-/g, "."); }
    function debounce(fn, wait) {
        var timer = 0;
        return function () {
            var args = arguments, ctx = this;
            clearTimeout(timer);
            timer = setTimeout(function () { fn.apply(ctx, args); }, wait);
        };
    }
    function getJSON(path) {
        return fetch(base + path, { credentials: "same-origin" }).then(function (res) {
            if (!res.ok) { throw new Error("HTTP " + res.status); }
            return res.json();
        });
    }
    function postEntries(data) {
        return Object.keys(data || {})
            .filter(function (key) { return data[key] && Array.isArray(data[key].labels); })
            .map(function (key) { return data[key]; });
    }

    /* ---------- 滚动进度与回顶部 ---------- */
    function initScrollUI() {
        var bar = $("#progressBar");
        var toTop = $("#toTop");
        var ticking = false;

        function update() {
            var doc = document.documentElement;
            var max = doc.scrollHeight - window.innerHeight;
            var ratio = max > 0 ? Math.min(1, window.scrollY / max) : 0;
            if (bar) { bar.style.width = (ratio * 100).toFixed(2) + "%"; }
            if (toTop) { toTop.hidden = window.scrollY < 600; }
            ticking = false;
        }
        function onScroll() {
            if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
        }

        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", update);
        update();
        if (toTop) {
            toTop.addEventListener("click", function () {
                window.scrollTo({ top: 0, behavior: "smooth" });
            });
        }
    }

    /* ---------- 文章页 ---------- */
    function addReadingTime(body) {
        var meta = $("#postMeta");
        if (!meta || meta.querySelector(".reading-time")) { return; }
        var text = body.innerText || body.textContent || "";
        var chars = text.replace(/\s+/g, "").length;
        if (!chars) { return; }
        var minutes = Math.max(1, Math.round(chars / 400));
        var span = document.createElement("span");
        span.className = "reading-time";
        span.textContent = "约 " + minutes + " 分钟";
        if (meta.children.length) {
            var sep = document.createElement("span");
            sep.className = "meta-sep";
            sep.textContent = "·";
            meta.appendChild(sep);
        }
        meta.appendChild(span);
    }

    function fillPostMeta() {
        var meta = $("#postMeta");
        if (!meta || meta.children.length) { return Promise.resolve(); }
        return getJSON("/postList.json").then(function (data) {
            var here = decodeURIComponent(location.pathname);
            var hit = postEntries(data).filter(function (item) {
                return here.indexOf(decodeURIComponent(item.postUrl)) !== -1;
            })[0];
            if (!hit) { return; }
            var html = '<time datetime="' + esc(hit.createdDate) + '">' + esc(fmtDate(hit.createdDate)) + "</time>";
            (hit.labels || []).forEach(function (label) {
                var color = data.labelColorDict && data.labelColorDict[label] ? data.labelColorDict[label] : "var(--accent)";
                html += '<a class="tag" style="--tag-color:' + esc(color) + '" href="' + base + "/tag.html#" + encodeURIComponent(label) + '">' + esc(label) + "</a>";
            });
            meta.innerHTML = html;
        }).catch(function () {});
    }

    function initTOC(body) {
        var headings = $$("h2, h3", body);
        if (headings.length < 3) { return; }
        var toc = $("#toc");
        var list = $("#tocList");
        var count = $("#tocCount");
        if (!toc || !list) { return; }

        headings.forEach(function (heading, i) {
            if (!heading.id) { heading.id = "sec-" + (i + 1); }
            var title = (heading.textContent || "").replace(/#\s*$/, "").trim();
            var anchor = document.createElement("a");
            anchor.className = "anchor";
            anchor.href = "#" + heading.id;
            anchor.setAttribute("aria-label", "链接到本节");
            anchor.textContent = "#";
            heading.appendChild(anchor);

            var link = document.createElement("a");
            link.href = "#" + heading.id;
            link.className = heading.tagName === "H3" ? "lvl-3" : "";
            link.textContent = title;
            link.dataset.target = heading.id;
            list.appendChild(link);
        });

        toc.hidden = false;
        if (count) { count.textContent = "(" + headings.length + ")"; }

        if (!("IntersectionObserver" in window)) { return; }
        var links = {};
        $$("a", list).forEach(function (link) { links[link.dataset.target] = link; });
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) { return; }
                Object.keys(links).forEach(function (id) {
                    links[id].classList.toggle("active", id === entry.target.id);
                });
            });
        }, { rootMargin: "-12% 0px -72% 0px", threshold: 0 });
        headings.forEach(function (heading) { observer.observe(heading); });
    }

    function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text);
        }
        return new Promise(function (resolve, reject) {
            var area = document.createElement("textarea");
            area.value = text;
            area.style.position = "fixed";
            area.style.opacity = "0";
            document.body.appendChild(area);
            area.select();
            try { document.execCommand("copy"); resolve(); }
            catch (err) { reject(err); }
            area.remove();
        });
    }

    function initCodeCopy(body) {
        $$("pre", body).forEach(function (pre) {
            var box = pre.closest(".highlight");
            if (!box) {
                box = document.createElement("div");
                box.className = "highlight";
                pre.parentNode.insertBefore(box, pre);
                box.appendChild(pre);
            }
            if (box.querySelector(".copy-btn")) { return; }

            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "copy-btn";
            btn.textContent = "复制";
            btn.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                var text = pre.innerText || pre.textContent || "";
                copyText(text).then(function () {
                    btn.textContent = "已复制";
                    btn.classList.add("is-done");
                    setTimeout(function () {
                        btn.textContent = "复制";
                        btn.classList.remove("is-done");
                    }, 1600);
                }).catch(function () {
                    btn.textContent = "复制失败";
                    setTimeout(function () { btn.textContent = "复制"; }, 1600);
                });
            });
            box.appendChild(btn);
        });
    }

    function initImageZoom(body) {
        var overlay = $("#lightbox");
        if (!overlay) { return; }
        var preview = $("#lightboxImg");
        var openLink = $("#lightboxLink");
        var close = $("#lightboxClose");

        function hide() {
            overlay.hidden = true;
            document.body.style.overflow = "";
        }

        $$("img", body).forEach(function (img, index) {
            img.loading = index === 0 ? "eager" : "lazy";
            img.decoding = "async";
            img.dataset.zoom = "";
            img.addEventListener("click", function (event) {
                event.preventDefault();
                var source = img.currentSrc || img.src;
                var anchor = img.closest("a");
                preview.src = source;
                preview.alt = img.alt || "";
                openLink.href = (anchor && anchor.href) || source;
                overlay.hidden = false;
                document.body.style.overflow = "hidden";
                close.focus();
            });
        });

        overlay.addEventListener("click", function (event) {
            if (event.target === overlay || event.target === close) { hide(); }
        });
        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && !overlay.hidden) { hide(); }
        });
    }

    function initProse(body) {
        $$("a[href]", body).forEach(function (link) {
            var href = link.getAttribute("href") || "";
            if (!/^https?:\/\//i.test(href)) { return; }
            try {
                if (new URL(href).host === location.host) { return; }
            } catch (err) { return; }
            link.target = "_blank";
            link.rel = "noopener noreferrer";
        });

        $$("table", body).forEach(function (table) {
            if (table.closest(".table-wrap") || table.closest("markdown-accessiblity-table")) { return; }
            var wrap = document.createElement("div");
            wrap.className = "table-wrap";
            table.parentNode.insertBefore(wrap, table);
            wrap.appendChild(table);
        });
    }

    function initPostNav() {
        var nav = $("#postNav");
        if (!nav) { return Promise.resolve(); }
        return getJSON("/postList.json").then(function (data) {
            var items = postEntries(data);
            var here = decodeURIComponent(location.pathname);
            var index = items.findIndex(function (item) {
                return here.indexOf(decodeURIComponent(item.postUrl)) !== -1;
            });
            if (index < 0) { return; }
            var newer = items[index - 1];
            var older = items[index + 1];
            var html = "";
            if (newer) {
                html += '<a class="prev" href="' + esc(newer.postUrl) + '"><span class="nav-dir">← 较新一篇</span><span class="nav-title">' + esc(newer.postTitle) + "</span></a>";
            }
            if (older) {
                html += '<a class="next" href="' + esc(older.postUrl) + '"><span class="nav-dir">较早一篇 →</span><span class="nav-title">' + esc(older.postTitle) + "</span></a>";
            }
            nav.innerHTML = html;
        }).catch(function () {});
    }

    function initPost() {
        var body = $("#postBody");
        if (!body) { return; }
        initProse(body);
        initImageZoom(body);
        initCodeCopy(body);
        initTOC(body);
        fillPostMeta().then(function () {
            addReadingTime(body);
        });
        initPostNav();
    }

    /* ---------- 归档 / 全文搜索 ---------- */
    function initArchive() {
        var listEl = $("#archiveList");
        var tagBar = $("#tagBar");
        var heading = $("#archiveHeading");
        var countEl = $("#archiveCount");
        var emptyEl = $("#emptyState");
        var loadingEl = $("#archiveLoading");
        var input = $("#searchInput");
        if (!listEl || !tagBar) { return; }

        var state = { tag: "all", query: "" };
        var items = [];
        var labelColors = {};
        var index = null;
        var indexByUrl = null;

        function fail(message) {
            if (loadingEl) { loadingEl.hidden = true; }
            listEl.innerHTML = "";
            heading.textContent = "加载失败";
            countEl.textContent = "";
            emptyEl.hidden = false;
            emptyEl.textContent = message || "归档数据加载失败，刷新页面试试。";
        }

        function ensureIndex() {
            if (index) { return Promise.resolve(index); }
            return getJSON("/search-index.json").then(function (data) {
                index = Array.isArray(data) ? data : [];
                indexByUrl = {};
                index.forEach(function (entry) { indexByUrl[entry.u] = entry; });
                return index;
            }).catch(function () {
                index = [];
                indexByUrl = {};
                return index;
            });
        }

        function entryFor(item) {
            return indexByUrl ? indexByUrl[item.postUrl] : null;
        }

        function matches(item, query) {
            var haystack = [item.postTitle, (item.labels || []).join(" ")].join(" ").toLowerCase();
            if (haystack.indexOf(query) !== -1) { return true; }
            var entry = entryFor(item);
            return Boolean(entry && entry.x && entry.x.toLowerCase().indexOf(query) !== -1);
        }

        function snippetFor(item, query) {
            var entry = entryFor(item);
            if (!entry || !entry.x) { return ""; }
            var lower = entry.x.toLowerCase();
            var at = lower.indexOf(query);
            if (at < 0) { return ""; }
            var start = Math.max(0, at - 42);
            var end = Math.min(entry.x.length, at + query.length + 78);
            var text = (start > 0 ? "…" : "") + entry.x.slice(start, end) + (end < entry.x.length ? "…" : "");
            var safe = esc(text);
            try {
                safe = safe.replace(new RegExp("(" + query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi"), "<mark>$1</mark>");
            } catch (err) { /* 忽略非法正则 */ }
            return safe;
        }

        function itemHTML(item, query) {
            var pin = item.top === 1 ? '<span class="pin-badge">置顶</span>' : "";
            var snippet = query ? snippetFor(item, query) : "";
            var labels = (item.labels || []).map(function (label) {
                var color = labelColors[label] || "var(--accent)";
                return '<span class="tag" style="--tag-color:' + esc(color) + '">' + esc(label) + "</span>";
            }).join("");
            return '<li class="post-item"><a class="post-link" href="' + esc(item.postUrl) + '">' +
                '<div class="post-text"><h3 class="post-title">' + pin + esc(item.postTitle) + "</h3>" +
                (snippet ? '<p class="post-snippet">' + snippet + "</p>" : "") + "</div>" +
                '<div class="post-meta"><time datetime="' + esc(item.createdDate) + '">' + esc(fmtDate(item.createdDate)) + "</time>" + labels + "</div>" +
                "</a></li>";
        }

        function syncHash() {
            var hash = state.query ? "#" + encodeURIComponent(state.query) : (state.tag === "all" ? "" : "#" + encodeURIComponent(state.tag));
            try {
                history.replaceState(null, "", location.pathname + location.search + hash);
            } catch (err) { /* 忽略 */ }
        }

        function render() {
            if (loadingEl) { loadingEl.hidden = true; }
            var query = state.query.toLowerCase();
            var filtered = items.filter(function (item) {
                if (state.tag !== "all" && (item.labels || []).indexOf(state.tag) === -1) { return false; }
                return !query || matches(item, query);
            });
            listEl.innerHTML = filtered.map(function (item) { return itemHTML(item, query); }).join("");
            emptyEl.hidden = filtered.length > 0;
            if (!emptyEl.hidden) { emptyEl.textContent = "没有找到匹配的文章，换个关键词试试。"; }
            countEl.textContent = filtered.length + " 篇";

            if (query) {
                heading.textContent = "搜索「" + state.query + "」";
            } else if (state.tag !== "all") {
                heading.textContent = "#" + state.tag;
            } else {
                heading.textContent = "全部文章";
            }

            $$(".tag-chip", tagBar).forEach(function (chip) {
                chip.setAttribute("aria-pressed", String(chip.dataset.tag === state.tag));
            });
        }

        function setTag(tag) {
            state.tag = tag;
            state.query = "";
            if (input) { input.value = ""; }
            syncHash();
            render();
        }

        function renderTags() {
            var counts = {};
            items.forEach(function (item) {
                (item.labels || []).forEach(function (label) {
                    counts[label] = (counts[label] || 0) + 1;
                });
            });
            var names = Object.keys(counts).sort(function (a, b) {
                return counts[b] - counts[a] || a.localeCompare(b, "zh-CN");
            });
            var html = '<button type="button" class="tag-chip" data-tag="all" aria-pressed="' + (state.tag === "all") + '">全部 <span class="n">' + items.length + "</span></button>";
            names.forEach(function (name) {
                html += '<button type="button" class="tag-chip" data-tag="' + esc(name) + '" aria-pressed="' + (state.tag === name) + '">' +
                    '<span class="dot" style="--tag-color:' + esc(labelColors[name] || "var(--accent)") + '"></span>' +
                    esc(name) + ' <span class="n">' + counts[name] + "</span></button>";
            });
            tagBar.innerHTML = html;
            $$(".tag-chip", tagBar).forEach(function (chip) {
                chip.addEventListener("click", function () { setTag(chip.dataset.tag); });
            });
        }

        getJSON("/postList.json").then(function (data) {
            items = postEntries(data);
            labelColors = data.labelColorDict || {};
            renderTags();

            var initial = "";
            try { initial = decodeURIComponent(location.hash.slice(1)).trim(); } catch (err) { initial = ""; }
            if (initial) {
                var known = $$(".tag-chip", tagBar).some(function (chip) { return chip.dataset.tag === initial; });
                if (known) { state.tag = initial; }
                else { state.query = initial; if (input) { input.value = initial; } }
            }

            if (state.query) {
                ensureIndex().then(render);
            } else {
                render();
            }

            var onSearch = debounce(function () {
                state.query = input.value.trim();
                if (state.query) {
                    ensureIndex().then(function () { syncHash(); render(); });
                } else {
                    syncHash();
                    render();
                }
            }, 130);

            input.addEventListener("input", onSearch);
            input.addEventListener("keydown", function (event) {
                if (event.key === "Escape") {
                    input.value = "";
                    state.query = "";
                    syncHash();
                    render();
                    input.blur();
                }
            });

            document.addEventListener("keydown", function (event) {
                if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) { return; }
                var tag = (document.activeElement && document.activeElement.tagName) || "";
                if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) { return; }
                event.preventDefault();
                input.focus();
            });

            window.addEventListener("hashchange", function () {
                var next = "";
                try { next = decodeURIComponent(location.hash.slice(1)).trim(); } catch (err) { next = ""; }
                if (!next) { state.tag = "all"; state.query = ""; if (input) { input.value = ""; } render(); return; }
                var isTag = $$(".tag-chip", tagBar).some(function (chip) { return chip.dataset.tag === next; });
                if (isTag) { state.tag = next; state.query = ""; if (input) { input.value = ""; } render(); }
            });
        }).catch(function () {
            fail();
        });
    }

    /* ---------- 启动 ---------- */
    document.addEventListener("DOMContentLoaded", function () {
        initScrollUI();
        if (page === "post") { initPost(); }
        else if (page === "archive") { initArchive(); }
    });
})();