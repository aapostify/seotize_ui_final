// SEOTIZE Blog — single-file Cloudflare Worker that server-renders /blogs so search engines
// get every article as real HTML (title, meta, canonical, Open Graph, JSON-LD and the body).
// Route:    seotize.net/blogs*
// Bindings: none. The page shell is the static /blogs page from the origin (same zone, so the
//           subrequest skips this Worker); articles come from api.seotize.net.
//
//   /blogs                 latest articles as crawlable links (?page=N for older pages)
//   /blogs?id=<id>         the article itself, opened in the reader
//   /blogs/sitemap.xml     every article — submit it in Google Search Console
//   /blogs.html?…          301 to /blogs?… so each article has a single URL

const API = 'https://api.seotize.net';
const SITE = 'https://seotize.net';
const PAGE_SIZE = 9;
const LIST_TITLE = 'Blog - SEOTIZE | SEO Insights & Strategies';

export default {
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (req.method !== 'GET' && req.method !== 'HEAD') return fetch(req);
    if (path === '/blogs/sitemap.xml') return sitemap();
    if (path === '/blogs.html') return Response.redirect(SITE + '/blogs' + url.search, 301);
    if (path !== '/blogs') return fetch(req);
    try {
      const id = url.searchParams.get('id');
      return id ? await article(url, id) : await listing(url);
    } catch (e) {
      return fetch(req); // never break the page: fall back to the client-rendered shell
    }
  }
};

// ---------- Data ----------

async function api(path) {
  const r = await fetch(API + path, { cf: { cacheTtl: 300, cacheEverything: true } });
  if (!r.ok) return null;
  return r.json().catch(() => null);
}

async function list(page, size = PAGE_SIZE) {
  const d = await api(`/blogs?page=${page}&page_size=${size}`);
  const ok = d && d.code === 200 && d.data && Array.isArray(d.data.blogs);
  return ok ? { blogs: d.data.blogs, pages: d.data.pagination?.pages || 1, total: d.data.pagination?.total || 0 } : { blogs: [], pages: 1, total: 0 };
}

async function shell(url) {
  const r = await fetch(new URL('/blogs', url.origin), { headers: { accept: 'text/html' } });
  if (!r.ok) throw new Error('shell ' + r.status);
  return r;
}

// ---------- Helpers ----------

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const link = id => '/blogs?id=' + encodeURIComponent(id);
const iso = d => { const t = new Date(d); return isNaN(t) ? '' : t.toISOString(); };
const nice = d => { const t = new Date(d); return isNaN(t) ? '' : t.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); };
const clock = d => { const t = new Date(d); return isNaN(t) ? '' : t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC'; };
const sized = (u, w, h) => !u ? '' : /image-api\.seotize\.net/.test(u) ? u + (u.includes('?') ? '&' : '?') + `w=${w}&h=${h}&fit=cover` : u;
const text = html => String(html || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const clip = (s, n) => s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…';
const ld = o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;

const set = (attr, value) => ({ element: e => { e.setAttribute(attr, value); } });
const inner = (html, isHtml = true) => ({ element: e => { e.setInnerContent(html, { html: isHtml }); } });

function head(rw, o) {
  return rw
    .on('title', inner(o.title, false))
    .on('meta[name="description"]', set('content', o.desc))
    .on('link[rel="canonical"]', set('href', o.url))
    .on('meta[property="og:type"]', set('content', o.type))
    .on('meta[property="og:title"]', set('content', o.title))
    .on('meta[property="og:description"]', set('content', o.desc))
    .on('meta[property="og:url"]', set('content', o.url))
    .on('meta[name="twitter:title"]', set('content', o.title))
    .on('meta[name="twitter:description"]', set('content', o.desc))
    .on('head', { element: e => { if (o.extra) e.append(o.extra, { html: true }); } });
}

function card(b, i) {
  return `<a class="card card-hover blog-card" href="${link(b._id)}" data-id="${esc(b._id)}">
    <div class="thumb"><img src="${esc(sized(b.image_url, 750, 422))}" alt="${esc(b.subject)}" width="750" height="422"${i > 2 ? ' loading="lazy"' : ''}><span class="cat">Blog</span></div>
    <div class="body">
      <div class="meta"><i class="ri-calendar-line"></i><time datetime="${iso(b.creation_date)}">${nice(b.creation_date)}</time></div>
      <h2>${esc(b.subject)}</h2>
      <p class="excerpt">${esc(b.title)}</p>
      <div class="foot"><span class="author"><span class="avatar">ST</span>SEOTIZE Team</span><span class="read">Read more <i class="ri-arrow-right-line"></i></span></div>
    </div>
  </a>`;
}

function pager(page, pages) {
  if (pages <= 1) return '';
  const a = (p, label, rel) => `<a class="page-btn${p === page ? ' active' : ''}" href="/blogs${p > 1 ? '?page=' + p : ''}"${rel ? ` rel="${rel}"` : ''}>${label}</a>`;
  const out = [];
  if (page > 1) out.push(a(page - 1, '‹', 'prev'));
  for (let p = Math.max(1, page - 2); p <= Math.min(pages, page + 2); p++) out.push(a(p, p));
  if (page < pages) out.push(a(page + 1, '›', 'next'));
  return out.join('');
}

const html = (res, status = 200) => new Response(res.body, {
  status, headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'public, max-age=300' }
});

// ---------- Pages ----------

async function listing(url) {
  const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
  const [res, l] = await Promise.all([shell(url), list(page)]);
  const canon = SITE + '/blogs' + (page > 1 ? '?page=' + page : '');
  const title = page > 1 ? `Blog - Page ${page} | SEOTIZE` : LIST_TITLE;
  const items = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    itemListElement: l.blogs.map((b, i) => ({ '@type': 'ListItem', position: (page - 1) * PAGE_SIZE + i + 1, url: SITE + link(b._id), name: b.subject }))
  };
  const rw = head(new HTMLRewriter(), {
    title, url: canon, type: 'website',
    desc: 'Discover the latest SEO strategies, AI content tips, and digital marketing insights from SEOTIZE experts. Stay ahead with cutting-edge SEO knowledge.',
    extra: (l.blogs.length ? ld(items) : '') + (page > 1 ? `<link rel="prev" href="${SITE}/blogs${page > 2 ? '?page=' + (page - 1) : ''}">` : '') + (page < l.pages ? `<link rel="next" href="${SITE}/blogs?page=${page + 1}">` : '')
  });
  if (l.blogs.length) rw.on('#blogGrid', inner(l.blogs.map(card).join(''))).on('#pagination', inner(pager(page, l.pages)));
  return html(rw.transform(res));
}

async function article(url, id) {
  const [res, a, l] = await Promise.all([shell(url), api('/blog/' + encodeURIComponent(id)), list(1, 6)]);
  if (!a || !a.subject) {
    const rw = new HTMLRewriter()
      .on('title', inner('Article not found - SEOTIZE Blog', false))
      .on('head', { element: e => { e.append('<meta name="robots" content="noindex">', { html: true }); } });
    return html(rw.transform(res), 404);
  }
  const canon = SITE + link(id);
  const desc = clip(text(a.title) || text(a.body), 160);
  const date = iso(a.creation_date);
  const cover = a.image_url ? sized(a.image_url, 1200, 675) : '';
  const related = l.blogs.filter(b => b._id !== id).slice(0, 5);
  const body = String(a.body || '').replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, '');

  // Same markup as showModal() in blogs.html
  const reader = `<div class="reader-main"><article>
      ${cover ? `<div class="reader-cover"><img src="${esc(cover)}" alt="${esc(a.subject)}" width="1200" height="675" fetchpriority="high"></div>` : ''}
      <div class="reader-meta">
        <span class="reader-cat"><i class="ri-bookmark-line"></i>Blog</span>
        <span class="reader-date"><i class="ri-calendar-line"></i><time datetime="${date}">${nice(a.creation_date)}</time></span>
        <div class="reader-author"><span class="reader-avatar">ST</span><div><b>SEOTIZE Team</b><small>${clock(a.creation_date)}</small></div></div>
      </div>
      <div class="prose blog-content">${body}</div>
    </article></div>
    ${related.length ? `<aside class="related"><h2 class="sidebar-title"><i class="ri-article-line"></i>Related Articles</h2>${related.map(b => `<a class="related-card" href="${link(b._id)}" data-id="${esc(b._id)}">
      <img src="${esc(sized(b.image_url, 700, 394))}" alt="" width="700" height="394" loading="lazy">
      <div class="related-body"><span class="related-cat">Blog</span><h3>${esc(b.subject)}</h3><small><i class="ri-calendar-line"></i>${nice(b.creation_date)}</small></div></a>`).join('')}</aside>` : ''}`;

  const posting = {
    '@context': 'https://schema.org', '@type': 'BlogPosting',
    headline: clip(a.subject, 110), description: desc, image: a.image_url ? [a.image_url] : undefined,
    datePublished: date, dateModified: iso(a.update_date || a.updated_at || a.creation_date) || date,
    url: canon, mainEntityOfPage: { '@type': 'WebPage', '@id': canon },
    wordCount: text(a.body).split(' ').length,
    author: { '@type': 'Organization', name: 'SEOTIZE', url: SITE },
    publisher: { '@type': 'Organization', name: 'SEOTIZE', url: SITE, logo: { '@type': 'ImageObject', url: SITE + '/android-chrome-512x512.png' } }
  };
  const crumbs = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: SITE + '/blogs' },
      { '@type': 'ListItem', position: 3, name: a.subject, item: canon }
    ]
  };

  const rw = head(new HTMLRewriter(), {
    title: `${a.subject} - SEOTIZE Blog`, desc, url: canon, type: 'article',
    extra: ld(posting) + ld(crumbs) + (date ? `<meta property="article:published_time" content="${date}">` : '')
  })
    .on('meta[property="og:image"]', set('content', a.image_url || SITE + '/seotize.png'))
    .on('meta[name="twitter:image"]', set('content', a.image_url || SITE + '/seotize.png'))
    .on('#blogModal', { element: e => { e.setAttribute('class', 'reader active'); e.setAttribute('data-ssr', id); } })
    .on('#readerTitle', inner(esc(a.subject)))
    .on('#blogModalBody', inner(reader))
    .on('#blogGrid', inner(l.blogs.map(card).join('')));
  return html(rw.transform(res));
}

async function sitemap() {
  const SIZE = 50, urls = [];
  const first = await list(1, SIZE);
  const rest = await Promise.all(Array.from({ length: Math.min(first.pages, 200) - 1 }, (_, i) => list(i + 2, SIZE)));
  [first, ...rest].forEach(p => p.blogs.forEach(b => urls.push(`<url><loc>${SITE}${esc(link(b._id))}</loc>${iso(b.creation_date) ? `<lastmod>${iso(b.creation_date)}</lastmod>` : ''}${b.image_url ? `<image:image><image:loc>${esc(b.image_url)}</image:loc></image:image>` : ''}</url>`)));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
<url><loc>${SITE}/blogs</loc><changefreq>daily</changefreq></url>
${urls.join('\n')}
</urlset>`;
  return new Response(xml, { headers: { 'content-type': 'application/xml;charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
