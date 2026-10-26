/* SEOTIZE — shared site behaviour: theme, navigation, reveals and GSAP scenes.
   Loaded with `defer` after gsap + ScrollTrigger, so both are available when this runs
   (if a CDN fails we degrade to a static page — nothing here is required for content). */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  /* ---------------- Theme ---------------- */
  function setThemeIcon() {
    const icon = $('#themeIcon');
    if (icon) icon.className = document.body.classList.contains('dark') ? 'ri-sun-line' : 'ri-moon-line';
  }
  window.toggleTheme = function () {
    const dark = document.body.classList.toggle('dark');
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (e) {}
    setThemeIcon();
    if (hasGsap && !reduce) gsap.fromTo('#themeIcon', { rotate: -90, scale: .4 }, { rotate: 0, scale: 1, duration: .5, ease: 'back.out(2)' });
  };
  setThemeIcon();

  /* ---------------- Logo ---------------- */
  // The logo animates with CSS; kept as a no-op for pages that still call it.
  window.animLogo = function () {};

  /* Partner logo: coin pop + ring pulse */
  if (hasGsap && !reduce && $('.logo-v1-ring')) {
    gsap.from('.topnav .logo-v1-icon', { scale: 0, rotate: -180, duration: .8, ease: 'back.out(1.7)' });
    gsap.fromTo('.logo-v1-ring', { scale: .85, opacity: .9 }, { scale: 1.35, opacity: 0, duration: 1.8, repeat: -1, repeatDelay: 1.2, ease: 'power2.out' });
  }

  /* ---------------- Top nav ---------------- */
  const topnav = $('.topnav');
  const toTop = $('.to-top');
  function onScroll() {
    const y = window.scrollY;
    if (topnav) topnav.classList.toggle('scrolled', y > 8);
    if (toTop) toTop.classList.toggle('show', y > 900);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  if (toTop) toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  /* ---------------- Mobile nav pill ---------------- */
  const mItems = $$('.mobile-item');
  const pill = $('.mobile-pill');
  function movePill() {
    const a = $('.mobile-item.active');
    if (!pill || !a) { if (pill) pill.style.width = '0'; return; }
    pill.style.width = a.offsetWidth + 'px';
    pill.style.transform = 'translateX(' + a.offsetLeft + 'px)';
  }
  window.SEOTIZE_setMobileActive = function (key) {
    mItems.forEach(i => i.classList.toggle('active', i.dataset.key === key));
    const links = $$('.nav-links a');
    if (links.some(a => a.dataset.key === key)) links.forEach(a => a.classList.toggle('active', a.dataset.key === key));
    $$('.nav-menu a[data-section]').forEach(a => a.classList.toggle('active', a.dataset.section === key));
    movePill();
  };
  window.addEventListener('resize', movePill);
  requestAnimationFrame(movePill);

  /* Section-based active state (pages that opt in with data-spy on <body>) */
  const spyIds = (document.body.dataset.spy || '').split(',').filter(Boolean);
  if (spyIds.length) {
    const spy = () => {
      let cur = spyIds[0];
      spyIds.forEach(id => { const s = document.getElementById(id); if (s && s.getBoundingClientRect().top < window.innerHeight * .4) cur = id; });
      window.SEOTIZE_setMobileActive(cur);
    };
    window.addEventListener('scroll', spy, { passive: true });
    requestAnimationFrame(spy);
  }

  /* ---------------- Cursor glow on cards ---------------- */
  $$('.tool-card').forEach(c => c.addEventListener('pointermove', e => {
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    c.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }));

  /* ---------------- Reveals & counters ---------------- */
  function initReveals() {
    if (!hasGsap || reduce) return;
    document.documentElement.classList.add('anim');
    $$('[data-reveal]').forEach(el => {
      gsap.to(el, { opacity: 1, y: 0, duration: .9, ease: 'power3.out', delay: +(el.dataset.delay || 0),
        scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    });
    $$('[data-stagger]').forEach(group => {
      const kids = group.children;
      gsap.from(kids, { opacity: 0, y: 30, duration: .8, ease: 'power3.out', stagger: .09,
        scrollTrigger: { trigger: group, start: 'top 85%', once: true } });
    });
    $$('[data-count]').forEach(el => {
      const end = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0), pre = el.dataset.pre || '', suf = el.dataset.suf || '';
      const o = { v: 0 };
      gsap.to(o, { v: end, duration: 1.8, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true },
        onUpdate: () => { el.textContent = pre + o.v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf; } });
    });
    $$('.marquee-track').forEach(t => {
      t.innerHTML += t.innerHTML;
      gsap.to(t, { xPercent: -50, duration: 32, ease: 'none', repeat: -1 });
    });
    $$('[data-parallax]').forEach(el => {
      gsap.to(el, { yPercent: +el.dataset.parallax, ease: 'none', scrollTrigger: { trigger: el.parentElement, scrub: true } });
    });
  }
  window.SEOTIZE_refreshReveals = function (root) {
    if (!hasGsap || reduce) return;
    $$('[data-reveal]', root).forEach(el => gsap.to(el, { opacity: 1, y: 0, duration: .8, ease: 'power3.out' }));
  };

  /* =====================================================================
     SCENES — animated SVG "placeholders" for media frames.
     Each builder fills an <svg viewBox="0 0 460 340"> and returns a looping
     GSAP timeline (paused). Colors come from --s-* CSS variables so every
     scene follows light/dark theme (or .scene-dark inside the hero).
     ===================================================================== */
  const C = { bg: 'var(--s-bg)', panel: 'var(--s-panel)', line: 'var(--s-line)', line2: 'var(--s-line-2)', ink: 'var(--s-ink)', dim: 'var(--s-dim)', steel: 'var(--s-steel)', a1: 'var(--s-a1)', a2: 'var(--s-a2)', good: 'var(--s-good)', bad: 'var(--s-bad)', gold: 'var(--s-gold)' };
  const T = (x, y, s, size, fill, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${s}</text>`;
  const panel = (x, y, w, h, title) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${C.panel}" stroke="${C.line}"/>` + (title ? T(x + 10, y + 18, title, 9.5, C.dim, 'letter-spacing="1"') : '');
  const header = (title, status, color, cls = 'sc-status') =>
    T(24, 30, title, 12, C.dim, 'letter-spacing="2"') +
    `<text class="${cls}" x="436" y="30" text-anchor="end" font-size="11" fill="${color}">${status}</text>` +
    `<line x1="24" y1="42" x2="436" y2="42" stroke="${C.line}"/>`;
  function typeTo(tl, node, text, at, dur, caret) {
    const o = { n: 0 };
    const x0 = +node.getAttribute('x');
    tl.to(o, { n: text.length, duration: dur, ease: 'none', onUpdate: () => {
      node.textContent = text.slice(0, Math.round(o.n));
      if (caret && node.getComputedTextLength) caret.setAttribute('x', x0 + node.getComputedTextLength() + 1);
    } }, at);
  }
  function countTo(tl, node, from, to, at, dur, fmt) {
    const o = { v: from };
    tl.to(o, { v: to, duration: dur, ease: 'power2.out', onUpdate: () => { node.textContent = fmt(o.v); } }, at);
  }
  const q = (svg, s) => svg.querySelector(s);
  const qa = (svg, s) => svg.querySelectorAll(s);

  const SCENES = {
    /* Real users search a keyword and your site climbs to #1 */
    serp(svg) {
      const rows = [0, 1, 2, 3].map(i => `<g class="sr"><g transform="translate(0 ${118 + i * 34})">
        <rect x="34" y="0" width="246" height="28" rx="5" fill="${C.panel}" stroke="${C.line}"/>
        <rect x="44" y="7" width="${70 + (i * 23) % 60}" height="5" rx="2" fill="${C.a1}" opacity=".55"/>
        <rect x="44" y="17" width="${140 + (i * 37) % 70}" height="4" rx="2" fill="${C.line2}"/></g></g>`).join('');
      svg.innerHTML = header('SEARCH SIMULATION', 'LIVE', C.good) +
        panel(24, 54, 266, 270) +
        `<circle cx="38" cy="66" r="3" fill="${C.bad}"/><circle cx="48" cy="66" r="3" fill="${C.gold}"/><circle cx="58" cy="66" r="3" fill="${C.good}"/>` +
        T(72, 69, 'search.engine/?q=', 8.5, C.steel) +
        `<rect x="34" y="80" width="246" height="26" rx="13" fill="${C.bg}" stroke="${C.line2}"/>` +
        `<circle cx="50" cy="93" r="5" fill="none" stroke="${C.dim}" stroke-width="1.5"/><line x1="54" y1="97" x2="58" y2="101" stroke="${C.dim}" stroke-width="1.5"/>` +
        `<text class="kw" x="66" y="97" font-size="10" fill="${C.ink}"></text><rect class="caret" x="66" y="86" width="1.5" height="13" fill="${C.a1}"/>` +
        rows +
        `<g class="mine" transform="translate(0 254)"><rect x="34" y="0" width="246" height="28" rx="5" fill="${C.a1}" fill-opacity=".12" stroke="${C.a1}"/>
          <text x="44" y="12" font-size="8.5" fill="${C.a1}" font-weight="700">yoursite.com</text>
          <rect x="44" y="17" width="150" height="4" rx="2" fill="${C.a1}" opacity=".45"/>
          <rect x="240" y="6" width="32" height="16" rx="8" fill="${C.a1}"/><text class="rank" x="256" y="17.5" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">#5</text></g>` +
        `<g class="cursor" transform="translate(240 300)"><path d="M0 0 L0 14 L4 10 L7 17 L9.5 16 L6.5 9 L12 9 Z" fill="${C.ink}" stroke="${C.bg}" stroke-width="1"/></g>` +
        `<circle class="ripple" cx="0" cy="0" r="4" fill="none" stroke="${C.a1}" stroke-width="2" opacity="0"/>` +
        panel(302, 54, 134, 128, 'REAL VISITORS') +
        `<text class="vis" x="312" y="104" font-size="28" font-weight="700" fill="${C.ink}">0</text>` +
        T(312, 120, 'humans · today', 8, C.steel) +
        [0, 1, 2, 3, 4, 5, 6].map(i => `<rect class="vb" x="${314 + i * 16}" y="128" width="10" height="44" rx="2" fill="${i === 6 ? C.a2 : C.a1}" opacity="${i === 6 ? 1 : .5}"/>`).join('') +
        panel(302, 192, 134, 132, 'SIGNALS') +
        ['Dwell time', 'Click-through', 'Return visits'].map((s, i) => T(312, 228 + i * 32, s, 8.5, C.dim) +
          `<rect x="312" y="${234 + i * 32}" width="114" height="5" rx="2.5" fill="${C.line}"/><rect class="sg" x="312" y="${234 + i * 32}" width="114" height="5" rx="2.5" fill="${[C.good, C.a2, C.a1][i]}"/>`).join('');
      const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 1.2 });
      const kw = q(svg, '.kw'), mine = q(svg, '.mine'), rank = q(svg, '.rank'), cur = q(svg, '.cursor'), rip = q(svg, '.ripple');
      const rowsEl = qa(svg, '.sr');
      tl.set(rowsEl, { y: 0 }).set(mine, { attr: { transform: 'translate(0 254)' } }).set(rank, { textContent: '#5' })
        .set(qa(svg, '.vb'), { scaleY: .1, transformOrigin: '50% 100%' }).set(qa(svg, '.sg'), { scaleX: 0, transformOrigin: '0% 50%' })
        .set(cur, { attr: { transform: 'translate(250 316)' } }).set(rip, { opacity: 0 }).set(kw, { textContent: '' });
      tl.to(q(svg, '.caret'), { opacity: 0, repeat: 5, yoyo: true, duration: .25, ease: 'steps(1)' }, 0);
      typeTo(tl, kw, 'best seo tools 2026', .2, 1.3, q(svg, '.caret'));
      tl.from(rowsEl, { opacity: 0, x: -10, stagger: .07, duration: .35 }, 1.5)
        .from(mine, { opacity: 0, duration: .3 }, 1.9);
      const steps = [['#4', 220], ['#3', 186], ['#2', 152], ['#1', 118]];
      steps.forEach(([r, y], k) => {
        const at = 2.4 + k * .55;
        tl.to(mine, { attr: { transform: `translate(0 ${y})` }, duration: .45, ease: 'power3.inOut' }, at)
          .to(rowsEl[3 - k], { y: 34, duration: .45, ease: 'power3.inOut' }, at)
          .set(rank, { textContent: r }, at + .25);
      });
      tl.to(qa(svg, '.vb'), { scaleY: (i) => .3 + i * .11, stagger: .06, duration: .5, ease: 'back.out(1.6)' }, 2.4);
      countTo(tl, q(svg, '.vis'), 0, 1284, 2.4, 2.4, v => Math.round(v).toLocaleString('en-US'));
      tl.to(cur, { attr: { transform: 'translate(150 128)' }, duration: .8, ease: 'power2.inOut' }, 4.7)
        .set(rip, { attr: { cx: 152, cy: 132, r: 4 }, opacity: 1 }, 5.5)
        .to(rip, { attr: { r: 26 }, opacity: 0, duration: .6 }, 5.5)
        .to(qa(svg, '.sg'), { scaleX: (i) => [.86, .72, .64][i], stagger: .12, duration: .7, ease: 'power3.out' }, 5.5)
        .to({}, { duration: 1.6 });
      return tl;
    },

    /* Global CDN: edge nodes light up, packets travel, an image gets compressed */
    cdn(svg) {
      const nodes = [[70, 110, 'NYC'], [150, 92, 'LON'], [178, 112, 'FRA'], [240, 150, 'DXB'], [292, 104, 'TYO'], [262, 196, 'SIN'], [96, 200, 'SAO'], [300, 232, 'SYD']];
      const ox = 175, oy = 160;
      let dots = '';
      for (let y = 70; y <= 252; y += 10) for (let x = 36; x <= 322; x += 10) {
        const n = Math.sin(x * .045) * Math.cos(y * .06) + Math.sin((x + y) * .03);
        if (n > .25) dots += `<circle cx="${x}" cy="${y}" r="1.4" fill="${C.line2}"/>`;
      }
      const paths = nodes.map(([x, y], i) => {
        const mx = (ox + x) / 2, my = Math.min(oy, y) - 40 - (i % 3) * 8;
        return `<path class="arc" d="M${ox} ${oy} Q${mx} ${my} ${x} ${y}" fill="none" stroke="${C.a2}" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="10 400" stroke-dashoffset="10"/>
                <path d="M${ox} ${oy} Q${mx} ${my} ${x} ${y}" fill="none" stroke="${C.a1}" stroke-opacity=".18" stroke-width="1"/>`;
      }).join('');
      const nodeEls = nodes.map(([x, y, n]) => `<g class="node"><circle cx="${x}" cy="${y}" r="9" fill="${C.a2}" opacity=".15" class="halo"/><circle cx="${x}" cy="${y}" r="3.5" fill="${C.a2}"/>${T(x + 7, y - 7, n, 7.5, C.dim)}</g>`).join('');
      const lat = [['Frankfurt', 12], ['London', 9], ['Tokyo', 18], ['Singapore', 21], ['New York', 14]];
      svg.innerHTML = header('GLOBAL EDGE NETWORK', '300+ POPS', C.a2) +
        panel(24, 54, 316, 214) + dots + paths + nodeEls +
        `<circle cx="${ox}" cy="${oy}" r="7" fill="${C.a1}"/><circle class="origin" cx="${ox}" cy="${oy}" r="7" fill="none" stroke="${C.a1}" stroke-width="2"/>` +
        panel(350, 54, 86, 214, 'LATENCY') +
        lat.map(([n, ms], i) => T(358, 92 + i * 36, n, 7.5, C.dim) + `<rect x="358" y="${98 + i * 36}" width="70" height="4" rx="2" fill="${C.line}"/>` +
          `<rect class="lt" x="358" y="${98 + i * 36}" width="${ms * 3}" height="4" rx="2" fill="${C.good}"/>` + T(428, 92 + i * 36, ms + 'ms', 7.5, C.good, 'text-anchor="end"')).join('') +
        panel(24, 278, 412, 46) +
        `<rect x="36" y="290" width="22" height="22" rx="4" fill="${C.a1}" opacity=".18"/><path d="M40 307 l5-6 4 4 3-3 3 5z" fill="${C.a1}"/>` +
        T(66, 299, 'hero-banner.jpg', 9, C.ink) + `<text class="sz" x="66" y="312" font-size="8" fill="${C.steel}">2.40 MB · JPEG</text>` +
        `<rect x="190" y="298" width="180" height="6" rx="3" fill="${C.line}"/><rect class="cbar" x="190" y="298" width="180" height="6" rx="3" fill="${C.a2}"/>` +
        `<text class="pct" x="426" y="305" text-anchor="end" font-size="10" font-weight="700" fill="${C.good}">−0%</text>`;
      const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: .6 });
      const arcs = qa(svg, '.arc'), halos = qa(svg, '.halo');
      tl.set(arcs, { attr: { 'stroke-dashoffset': 10 } }).set(qa(svg, '.lt'), { scaleX: 0, transformOrigin: '0% 50%' })
        .set(q(svg, '.cbar'), { scaleX: 0, transformOrigin: '0% 50%' }).set(halos, { scale: 1, transformOrigin: '50% 50%' });
      tl.fromTo(q(svg, '.origin'), { attr: { r: 7 }, opacity: 1 }, { attr: { r: 30 }, opacity: 0, duration: 1.4, repeat: 2, ease: 'power1.out' }, 0);
      tl.to(arcs, { attr: { 'stroke-dashoffset': -330 }, duration: 1.6, ease: 'power1.in', stagger: .12 }, .1);
      tl.fromTo(halos, { scale: .4 }, { scale: 1.8, opacity: 0, duration: .8, stagger: .12, ease: 'power2.out' }, 1.2);
      tl.to(qa(svg, '.lt'), { scaleX: 1, duration: .6, stagger: .1, ease: 'power3.out' }, .6);
      tl.to(q(svg, '.cbar'), { scaleX: 1, duration: 2.2, ease: 'power2.inOut' }, 1.2);
      countTo(tl, q(svg, '.pct'), 0, 92, 1.2, 2.2, v => '−' + Math.round(v) + '%');
      tl.set(q(svg, '.sz'), { textContent: '184 KB · WebP · resized' }, 3.4).to({}, { duration: 2 });
      return tl;
    },

    /* AI writes an SEO article; the score gauge climbs */
    ai(svg) {
      const lines = [0, 1, 2, 3, 4, 5].map(i => `<rect class="ln" x="40" y="${168 + i * 14}" width="${[200, 214, 176, 208, 190, 120][i]}" height="5" rx="2.5" fill="${C.line2}"/>`).join('');
      const checks = ['Keyword in title', 'Meta description', 'Heading structure', 'Readability', 'Image alt text'];
      const R = 34, CIRC = 2 * Math.PI * R;
      svg.innerHTML = header('AI CONTENT STUDIO', 'GENERATING', C.gold) +
        panel(24, 54, 254, 270) +
        T(40, 76, 'ARTICLE · DRAFT', 8, C.steel, 'letter-spacing="1.5"') +
        `<text class="ttl" x="40" y="100" font-size="13" font-weight="700" fill="${C.ink}"></text>` +
        `<rect class="cur" x="40" y="89" width="1.5" height="14" fill="${C.a1}"/>` +
        `<rect class="img" x="40" y="114" width="222" height="42" rx="6" fill="${C.a1}" fill-opacity=".1" stroke="${C.a1}" stroke-opacity=".35" stroke-dasharray="4 3"/>` +
        `<path class="mtn" d="M120 150 l18-20 12 12 8-8 18 16z" fill="${C.a1}" opacity="0"/><circle class="sun" cx="182" cy="126" r="5" fill="${C.gold}" opacity="0"/>` +
        lines +
        `<rect x="40" y="260" width="222" height="52" rx="6" fill="${C.bg}" stroke="${C.line}"/>` +
        T(50, 278, 'META', 7.5, C.steel, 'letter-spacing="1.5"') +
        `<text class="meta" x="50" y="294" font-size="8.5" fill="${C.dim}"></text>` +
        panel(290, 54, 146, 130, 'SEO SCORE') +
        `<circle cx="363" cy="126" r="${R}" fill="none" stroke="${C.line}" stroke-width="7"/>` +
        `<circle class="gauge" cx="363" cy="126" r="${R}" fill="none" stroke="${C.good}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}" transform="rotate(-90 363 126)"/>` +
        `<text class="score" x="363" y="133" text-anchor="middle" font-size="20" font-weight="700" fill="${C.ink}">0</text>` +
        panel(290, 194, 146, 130, 'CHECKLIST') +
        checks.map((c, i) => `<g class="ck" transform="translate(0 ${226 + i * 19})"><circle cx="302" cy="-3" r="5" fill="${C.line}"/><path class="tick" d="M299.5 -3 l2 2 4 -4" stroke="#fff" stroke-width="1.4" fill="none" opacity="0"/>${T(313, 0, c, 8, C.dim)}</g>`).join('');
      const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 1 });
      const ttl = q(svg, '.ttl'), meta = q(svg, '.meta'), status = q(svg, '.sc-status');
      tl.set([ttl, meta], { textContent: '' }).set(qa(svg, '.ln'), { scaleX: 0, transformOrigin: '0% 50%' })
        .set(q(svg, '.gauge'), { attr: { 'stroke-dashoffset': CIRC } }).set([q(svg, '.mtn'), q(svg, '.sun')], { opacity: 0 })
        .set(qa(svg, '.ck circle'), { attr: { fill: 'var(--s-line)' } }).set(qa(svg, '.tick'), { opacity: 0 })
        .set(status, { textContent: 'GENERATING', attr: { fill: 'var(--s-gold)' } });
      typeTo(tl, ttl, '10 SEO Wins for 2026', .2, 1.2, q(svg, '.cur'));
      tl.to(q(svg, '.cur'), { opacity: 0, repeat: 7, yoyo: true, duration: .2, ease: 'steps(1)' }, 0);
      tl.to(qa(svg, '.ln'), { scaleX: 1, duration: .45, stagger: .16, ease: 'power2.out' }, 1.4);
      tl.to([q(svg, '.mtn'), q(svg, '.sun')], { opacity: 1, duration: .6 }, 2.2).from(q(svg, '.mtn'), { y: 10, duration: .6, ease: 'back.out(2)' }, 2.2);
      typeTo(tl, meta, 'Practical steps to rank higher this…', 2.6, 1.4);
      tl.to(q(svg, '.gauge'), { attr: { 'stroke-dashoffset': CIRC * .02 }, duration: 2.8, ease: 'power2.inOut' }, 1.4);
      countTo(tl, q(svg, '.score'), 0, 98, 1.4, 2.8, v => Math.round(v));
      qa(svg, '.ck').forEach((g, i) => {
        tl.set(g.querySelector('circle'), { attr: { fill: 'var(--s-good)' } }, 1.8 + i * .5)
          .to(g.querySelector('.tick'), { opacity: 1, duration: .2 }, 1.8 + i * .5)
          .from(g, { x: -4, duration: .3 }, 1.8 + i * .5);
      });
      tl.set(status, { textContent: 'READY TO PUBLISH', attr: { fill: 'var(--s-good)' } }, 4.3).to({}, { duration: 2 });
      return tl;
    },

    /* AI background remover: scan line sweeps, background drops to a transparent checkerboard */
    bgremove(svg) {
      let checker = '';
      for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) if ((x + y) % 2) checker += `<rect x="${40 + x * 18}" y="${68 + y * 18}" width="18" height="18" fill="${C.line}"/>`;
      svg.innerHTML = header('AI BACKGROUND REMOVER', 'PROCESSING', C.gold) +
        `<defs><clipPath id="bgClip"><rect x="40" y="68" width="234" height="234" rx="8"/></clipPath>
           <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f59e0b"/><stop offset="1" stop-color="#db2777"/></linearGradient>
           <linearGradient id="subj" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b82f6"/><stop offset="1" stop-color="#1e40af"/></linearGradient></defs>` +
        `<rect x="40" y="68" width="234" height="234" rx="8" fill="${C.panel}" stroke="${C.line}"/>` +
        `<g clip-path="url(#bgClip)">${checker}
           <g class="bg"><rect x="40" y="68" width="234" height="234" fill="url(#bgGrad)"/>
             <circle cx="90" cy="110" r="26" fill="#fde68a" opacity=".7"/><path d="M40 260 Q110 210 180 250 T274 230 V302 H40z" fill="#7c2d12" opacity=".45"/></g>
           <g class="subject"><circle cx="157" cy="150" r="34" fill="#fcd9b6"/><path d="M123 142 q34 -46 68 0 q-6 -32 -34 -34 q-28 2 -34 34z" fill="#1f2937"/>
             <path d="M97 302 q6 -96 60 -96 q54 0 60 96z" fill="url(#subj)"/></g>
           <rect class="scan" x="40" y="68" width="234" height="3" fill="${C.a2}"/>
           <rect class="scanglow" x="40" y="40" width="234" height="28" fill="${C.a2}" opacity=".18"/></g>` +
        panel(290, 54, 146, 150, 'RESULT') +
        T(300, 96, 'Subject', 8.5, C.dim) + `<text class="r1" x="426" y="96" text-anchor="end" font-size="8.5" fill="${C.ink}">—</text>` +
        T(300, 118, 'Edges', 8.5, C.dim) + `<text class="r2" x="426" y="118" text-anchor="end" font-size="8.5" fill="${C.ink}">—</text>` +
        T(300, 140, 'Output', 8.5, C.dim) + `<text class="r3" x="426" y="140" text-anchor="end" font-size="8.5" fill="${C.ink}">—</text>` +
        T(300, 162, 'Time', 8.5, C.dim) + `<text class="r4" x="426" y="162" text-anchor="end" font-size="8.5" fill="${C.good}">—</text>` +
        `<rect x="300" y="174" width="126" height="20" rx="10" fill="${C.a1}"/><text x="363" y="187" text-anchor="middle" font-size="8.5" font-weight="700" fill="#fff">↓ DOWNLOAD PNG</text>` +
        panel(290, 214, 146, 110, 'FREE TOOLS') +
        ['Background remover', 'Image optimizer', 'Image crop'].map((t, i) => `<g class="tl"><rect x="300" y="${234 + i * 28}" width="126" height="22" rx="6" fill="${C.bg}" stroke="${C.line}"/><circle cx="312" cy="${245 + i * 28}" r="3" fill="${[C.a2, C.good, C.gold][i]}"/>${T(320, 248 + i * 28, t, 8, C.ink)}</g>`).join('');
      const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 1 });
      const bg = q(svg, '.bg'), scan = q(svg, '.scan'), glow = q(svg, '.scanglow'), st = q(svg, '.sc-status');
      tl.set(bg, { opacity: 1 }).set([scan, glow], { y: 0, opacity: 1 }).set(qa(svg, '.r1,.r2,.r3,.r4'), { textContent: '—' })
        .set(st, { textContent: 'PROCESSING', attr: { fill: 'var(--s-gold)' } }).set(q(svg, '.subject'), { scale: 1, transformOrigin: '157px 220px' });
      tl.from(qa(svg, '.tl'), { opacity: 0, x: 8, stagger: .1, duration: .3 }, 0);
      tl.to([scan, glow], { y: 231, duration: 1.8, ease: 'power1.inOut' }, .4)
        .to(bg, { opacity: 0, duration: 1, ease: 'power2.inOut' }, 1.6)
        .to([scan, glow], { opacity: 0, duration: .3 }, 2.2)
        .to(q(svg, '.subject'), { scale: 1.04, duration: .35, yoyo: true, repeat: 1, ease: 'power2.out' }, 2.4)
        .set(q(svg, '.r1'), { textContent: 'person · 99%' }, 1.2).set(q(svg, '.r2'), { textContent: 'refined' }, 1.7)
        .set(q(svg, '.r3'), { textContent: 'PNG · alpha' }, 2.2).set(q(svg, '.r4'), { textContent: '1.2 s' }, 2.4)
        .set(st, { textContent: 'DONE', attr: { fill: 'var(--s-good)' } }, 2.4).to({}, { duration: 2.4 });
      return tl;
    },

    /* Live session log of real visitors */
    engage(svg) {
      const sess = [['US', 'best seo tools', '/pricing', '3m 12s'], ['DE', 'seo agency berlin', '/blog/guide', '4m 40s'], ['BR', 'site speed test', '/', '2m 05s'],
        ['IN', 'keyword tracker', '/features', '5m 18s'], ['GB', 'image cdn free', '/tools', '3m 51s'], ['JP', 'ai article writer', '/blog', '2m 47s'], ['CA', 'rank higher google', '/', '4m 02s']];
      svg.innerHTML = header('LIVE SESSION LOG', '● LIVE', C.good) +
        `<clipPath id="engClip"><rect x="24" y="80" width="260" height="236"/></clipPath>` +
        panel(24, 54, 260, 270, 'REAL VISITORS') +
        `<g clip-path="url(#engClip)"><g class="log">` + sess.map(([cc, kw, pg, t], i) => `<g transform="translate(0 ${92 + i * 34})">
          <rect x="34" y="0" width="240" height="28" rx="5" fill="${C.bg}" stroke="${C.line}"/>
          <rect x="40" y="7" width="22" height="14" rx="3" fill="${C.a1}" fill-opacity=".15"/>${T(51, 17, cc, 7.5, C.a1, 'text-anchor="middle" font-weight="700"')}
          ${T(70, 12, '"' + kw + '"', 8.5, C.ink)}${T(70, 23, '→ ' + pg, 7.5, C.steel)}${T(266, 17, t, 8, C.good, 'text-anchor="end"')}</g>`).join('') + `</g></g>` +
        panel(296, 54, 140, 84, 'AVG. DWELL TIME') +
        `<text class="dw" x="306" y="112" font-size="26" font-weight="700" fill="${C.ink}">0:00</text>` + T(306, 128, 'min · per visit', 8, C.steel) +
        panel(296, 148, 140, 84, 'BOUNCE RATE') +
        `<text class="br" x="306" y="204" font-size="26" font-weight="700" fill="${C.good}">0%</text>` + T(370, 204, '↓ low', 8.5, C.good) +
        panel(296, 242, 140, 82, 'ENGAGEMENT') +
        `<path class="spark" d="M306 312 L322 304 L338 308 L354 296 L370 298 L386 284 L402 288 L426 270" fill="none" stroke="${C.a2}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
      const spark = q(svg, '.spark'), L = 160;
      spark.setAttribute('stroke-dasharray', L);
      const tl = gsap.timeline({ paused: true, repeat: -1 });
      tl.set(q(svg, '.log'), { y: 0 }).set(spark, { attr: { 'stroke-dashoffset': L } });
      tl.from(qa(svg, '.log > g'), { opacity: 0, x: -12, stagger: .15, duration: .4 }, 0)
        .to(q(svg, '.log'), { y: -68, duration: 1.2, ease: 'power2.inOut' }, 2.4)
        .to(q(svg, '.log'), { y: -10, duration: 1.2, ease: 'power2.inOut' }, 5);
      countTo(tl, q(svg, '.dw'), 0, 221, .3, 2.2, v => Math.floor(v / 60) + ':' + String(Math.round(v) % 60).padStart(2, '0'));
      countTo(tl, q(svg, '.br'), 64, 18, .3, 2.2, v => Math.round(v) + '%');
      tl.to(spark, { attr: { 'stroke-dashoffset': 0 }, duration: 2, ease: 'power2.out' }, .5)
        .to(q(svg, '.sc-status'), { opacity: .3, repeat: 7, yoyo: true, duration: .4 }, 0).to({}, { duration: 1 });
      return tl;
    },

    /* Free plan meters */
    free(svg) {
      const meters = [['Articles hosted', 30, C.a1], ['Images stored', 100, C.a2], ['AI credits', 3, C.gold], ['CDN bandwidth', '∞', C.good]];
      svg.innerHTML = header('FREE PLAN · LIFETIME', 'ACTIVE', C.good) +
        panel(24, 54, 200, 270) +
        T(40, 84, 'YOU PAY', 8, C.steel, 'letter-spacing="1.5"') +
        `<text class="price" x="40" y="132" font-size="40" font-weight="700" fill="${C.ink}">$9.99</text>` +
        `<line class="strike" x1="38" y1="118" x2="160" y2="118" stroke="${C.bad}" stroke-width="3" stroke-linecap="round"/>` +
        T(40, 152, 'per month · forever', 9, C.dim) +
        `<g class="badge"><rect x="40" y="174" width="168" height="26" rx="13" fill="${C.good}" fill-opacity=".14" stroke="${C.good}"/>${T(124, 191, '✓ NO CARD REQUIRED', 9, C.good, 'text-anchor="middle" font-weight="700"')}</g>` +
        `<g class="badge"><rect x="40" y="210" width="168" height="26" rx="13" fill="${C.a1}" fill-opacity=".12" stroke="${C.a1}"/>${T(124, 227, '✓ FREE IMAGE TOOLS', 9, C.a1, 'text-anchor="middle" font-weight="700"')}</g>` +
        `<g class="badge"><rect x="40" y="246" width="168" height="26" rx="13" fill="${C.a2}" fill-opacity=".12" stroke="${C.a2}"/>${T(124, 263, '✓ CANCEL NOTHING', 9, C.a2, 'text-anchor="middle" font-weight="700"')}</g>` +
        panel(236, 54, 200, 270, 'INCLUDED') +
        meters.map(([n, v, col], i) => `<g transform="translate(0 ${96 + i * 56})">${T(248, 0, n, 9, C.dim)}
          <text class="mv" data-v="${v}" x="424" y="0" text-anchor="end" font-size="11" font-weight="700" fill="${C.ink}">0</text>
          <rect x="248" y="10" width="176" height="8" rx="4" fill="${C.line}"/><rect class="mb" x="248" y="10" width="176" height="8" rx="4" fill="${col}"/></g>`).join('');
      const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 1.4 });
      const price = q(svg, '.price'), strike = q(svg, '.strike');
      tl.set(price, { textContent: '$9.99' }).set(strike, { scaleX: 0, transformOrigin: '0% 50%' }).set(qa(svg, '.mb'), { scaleX: 0, transformOrigin: '0% 50%' });
      tl.to(strike, { scaleX: 1, duration: .5, ease: 'power2.in' }, .5)
        .to(price, { opacity: 0, duration: .2 }, 1.1).set(price, { textContent: '$0.00' }, 1.3).to(price, { opacity: 1, duration: .3 }, 1.3)
        .to(strike, { opacity: 0, duration: .2 }, 1.3)
        .from(qa(svg, '.badge'), { opacity: 0, y: 8, stagger: .15, duration: .4 }, 1.5)
        .to(qa(svg, '.mb'), { scaleX: (i) => [.75, .9, .5, 1][i], stagger: .15, duration: 1, ease: 'power3.out' }, .4);
      qa(svg, '.mv').forEach((m, i) => {
        const v = m.dataset.v;
        if (v === '∞') tl.set(m, { textContent: '∞' }, .4 + i * .15);
        else countTo(tl, m, 0, +v, .4 + i * .15, 1, x => Math.round(x));
      });
      tl.set(strike, { opacity: 1 }, '+=2.5');
      return tl;
    },

    /* Free image tools: compress to WebP, compare before/after, crop to 16:9 */
    optimize(svg) {
      svg.innerHTML = header('IMAGE OPTIMIZER', 'FREE TOOL', C.a1) +
        `<defs><clipPath id="opClip"><rect x="34" y="64" width="230" height="172" rx="6"/></clipPath>
           <clipPath id="opLeft"><rect class="opl" x="34" y="64" width="115" height="172"/></clipPath>
           <linearGradient id="opSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#38bdf8"/><stop offset="1" stop-color="#bae6fd"/></linearGradient></defs>` +
        panel(24, 54, 250, 270) +
        `<g clip-path="url(#opClip)">
           <rect x="34" y="64" width="230" height="172" fill="url(#opSky)"/>
           <circle cx="214" cy="104" r="16" fill="#fde68a"/>
           <path d="M34 210 L90 150 L130 186 L176 132 L264 206 V236 H34 Z" fill="#0f766e"/>
           <path d="M34 236 L80 196 L132 222 L190 184 L264 228 V236 Z" fill="#115e59"/>
           <g clip-path="url(#opLeft)">${Array.from({ length: 70 }, (_, i) => `<rect x="${34 + (i * 37) % 115}" y="${64 + (i * 53) % 172}" width="2" height="2" fill="#0f172a" opacity=".22"/>`).join('')}</g>
           <g class="crop"><path class="cropmask" fill="#020617" fill-opacity=".55" fill-rule="evenodd" d="M34 64 H264 V236 H34 Z M34 64 H264 V236 H34 Z"/>
             <rect class="cropbox" x="34" y="64" width="230" height="172" fill="none" stroke="#fff" stroke-width="1.5"/></g>
         </g>
         <line class="split" x1="149" y1="64" x2="149" y2="236" stroke="#fff" stroke-width="2"/>
         <g class="handle"><circle cx="149" cy="150" r="10" fill="#fff"/><path d="M144 150 l-3 0 M154 150 l3 0 M143 147 l-3 3 3 3 M155 147 l3 3 -3 3" stroke="${C.a1}" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>
         <rect x="42" y="72" width="54" height="16" rx="8" fill="#020617" fill-opacity=".6"/>${T(69, 83, 'ORIGINAL', 7, '#fff', 'text-anchor="middle" letter-spacing="1"')}
         <rect x="206" y="72" width="50" height="16" rx="8" fill="${C.a1}"/>${T(231, 83, 'WEBP', 7, '#fff', 'text-anchor="middle" letter-spacing="1"')}
         <text class="dims" x="149" y="258" text-anchor="middle" font-size="9" fill="${C.dim}">2400 × 1800 px</text>
         ${['16:9', '1:1', '4:3', 'Free'].map((r, i) => `<g class="ratio" data-i="${i}"><rect x="${50 + i * 52}" y="274" width="44" height="20" rx="6" fill="${C.bg}" stroke="${C.line}" class="rb"/>${T(72 + i * 52, 288, r, 8, C.dim, 'text-anchor="middle" class="rt"')}</g>`).join('')}
         <rect class="dl" x="50" y="300" width="200" height="16" rx="8" fill="${C.a1}" opacity="0"/>
         <text class="dlt" x="150" y="311" text-anchor="middle" font-size="7.5" font-weight="700" fill="#fff" opacity="0">↓ DOWNLOAD hero-banner.webp</text>` +
        panel(286, 54, 150, 130, 'FILE SIZE') +
        T(296, 92, 'JPEG', 8, C.dim) + `<rect x="296" y="98" width="130" height="7" rx="3.5" fill="${C.bad}" opacity=".75"/>` + T(426, 92, '2.40 MB', 8, C.ink, 'text-anchor="end"') +
        T(296, 124, 'WebP', 8, C.dim) + `<rect x="296" y="130" width="130" height="7" rx="3.5" fill="${C.line}"/><rect class="wb" x="296" y="130" width="130" height="7" rx="3.5" fill="${C.good}"/>` +
        `<text class="ws" x="426" y="124" text-anchor="end" font-size="8" fill="${C.ink}">2.40 MB</text>` +
        `<text class="save" x="296" y="166" font-size="20" font-weight="700" fill="${C.good}">−0%</text>` + T(372, 166, 'smaller', 8, C.dim) +
        panel(286, 194, 150, 130, 'PAGE SPEED') +
        `<circle cx="361" cy="262" r="30" fill="none" stroke="${C.line}" stroke-width="6"/>` +
        `<circle class="sp" cx="361" cy="262" r="30" fill="none" stroke="${C.good}" stroke-width="6" stroke-linecap="round" stroke-dasharray="188.5" stroke-dashoffset="86.7" transform="rotate(-90 361 262)"/>` +
        `<text class="spv" x="361" y="269" text-anchor="middle" font-size="18" font-weight="700" fill="${C.ink}">54</text>` + T(361, 312, 'Lighthouse score', 7.5, C.steel, 'text-anchor="middle"');
      const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 1 });
      const split = q(svg, '.split'), handle = q(svg, '.handle'), opl = q(svg, '.opl');
      const full = 'M34 64 H264 V236 H34 Z', crop = 'M34 64 H264 V236 H34 Z M34 85.3 H264 V214.7 H34 Z';
      tl.set([split, handle], { x: 0 }).set(opl, { attr: { width: 115 } }).set(q(svg, '.wb'), { scaleX: 1, transformOrigin: '0% 50%' })
        .set(q(svg, '.ws'), { textContent: '2.40 MB' }).set(q(svg, '.save'), { textContent: '−0%' })
        .set(q(svg, '.sp'), { attr: { 'stroke-dashoffset': 86.7 } }).set(q(svg, '.spv'), { textContent: '54' })
        .set(q(svg, '.cropmask'), { attr: { d: full } }).set(q(svg, '.cropbox'), { attr: { y: 64, height: 172 } })
        .set(q(svg, '.dims'), { textContent: '2400 × 1800 px' }).set(qa(svg, '.rb'), { attr: { fill: 'var(--s-bg)', stroke: 'var(--s-line)' } })
        .set([q(svg, '.dl'), q(svg, '.dlt')], { opacity: 0 });
      // compare: sweep the divider across the photo
      tl.to([split, handle], { x: -70, duration: .9, ease: 'power2.inOut' }, .3).to(opl, { attr: { width: 45 }, duration: .9, ease: 'power2.inOut' }, .3)
        .to([split, handle], { x: 70, duration: 1.2, ease: 'power2.inOut' }, 1.3).to(opl, { attr: { width: 185 }, duration: 1.2, ease: 'power2.inOut' }, 1.3)
        .to([split, handle], { x: 0, duration: .8, ease: 'power2.inOut' }, 2.6).to(opl, { attr: { width: 115 }, duration: .8, ease: 'power2.inOut' }, 2.6)
        .to(q(svg, '.wb'), { scaleX: .077, duration: 1.6, ease: 'power3.inOut' }, .6);
      countTo(tl, q(svg, '.ws'), 2400, 186, .6, 1.6, v => v >= 1000 ? (v / 1000).toFixed(2) + ' MB' : Math.round(v) + ' KB');
      countTo(tl, q(svg, '.save'), 0, 92, .6, 1.6, v => '−' + Math.round(v) + '%');
      tl.to(q(svg, '.sp'), { attr: { 'stroke-dashoffset': 7.5 }, duration: 1.6, ease: 'power2.out' }, 1.2);
      countTo(tl, q(svg, '.spv'), 54, 96, 1.2, 1.6, v => Math.round(v));
      // crop to 16:9
      tl.to(q(svg, '.rb'), { attr: { fill: 'var(--s-a1)', stroke: 'var(--s-a1)' }, duration: .2 }, 3.6)
        .to(q(svg, '.cropmask'), { attr: { d: crop }, duration: .7, ease: 'power3.inOut' }, 3.7)
        .to(q(svg, '.cropbox'), { attr: { y: 85.3, height: 129.4 }, duration: .7, ease: 'power3.inOut' }, 3.7)
        .set(q(svg, '.dims'), { textContent: '2400 × 1350 px · 16:9' }, 4.2)
        .to([q(svg, '.dl'), q(svg, '.dlt')], { opacity: 1, duration: .4 }, 4.5)
        .to({}, { duration: 1.8 });
      return tl;
    },

    /* Keyword rank tracking chart */
    rank(svg) {
      const kws = [['seo agency', 14, 3], ['image cdn', 22, 5], ['ai writer', 31, 8], ['rank tracker', 9, 1]];
      const pts = [[44, 236], [80, 228], [116, 232], [152, 206], [188, 196], [224, 170], [260, 152], [292, 120]];
      const d = 'M' + pts.map(p => p.join(' ')).join(' L');
      svg.innerHTML = header('KEYWORD RANK TRACKER', '↑ IMPROVING', C.good) +
        panel(24, 54, 284, 270, 'VISIBILITY · 30 DAYS') +
        [0, 1, 2, 3].map(i => `<line x1="44" y1="${100 + i * 46}" x2="292" y2="${100 + i * 46}" stroke="${C.line}" stroke-dasharray="3 4"/>`).join('') +
        `<defs><linearGradient id="rkFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--s-a1)" stop-opacity=".35"/><stop offset="1" stop-color="var(--s-a1)" stop-opacity="0"/></linearGradient></defs>` +
        `<path class="area" d="${d} L292 280 L44 280 Z" fill="url(#rkFill)"/>` +
        `<path class="line" d="${d}" fill="none" stroke="${C.a1}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` +
        pts.map(([x, y]) => `<circle class="pt" cx="${x}" cy="${y}" r="3" fill="${C.panel}" stroke="${C.a1}" stroke-width="2"/>`).join('') +
        `<g class="tip"><rect x="236" y="88" width="64" height="22" rx="5" fill="${C.a1}"/>${T(268, 102, '+184%', 9.5, '#fff', 'text-anchor="middle" font-weight="700"')}</g>` +
        ['W1', 'W2', 'W3', 'W4'].map((w, i) => T(54 + i * 76, 304, w, 8, C.steel)).join('') +
        panel(320, 54, 116, 270, 'POSITIONS') +
        kws.map(([k, a, b], i) => `<g transform="translate(0 ${96 + i * 54})">${T(330, 0, k, 8.5, C.dim)}
          <text class="ps" data-a="${a}" data-b="${b}" x="330" y="26" font-size="20" font-weight="700" fill="${C.ink}">#${a}</text>
          <text class="up" x="426" y="26" text-anchor="end" font-size="9" font-weight="700" fill="${C.good}">▲ ${a - b}</text></g>`).join('');
      const line = q(svg, '.line'), L = line.getTotalLength ? line.getTotalLength() : 320;
      line.setAttribute('stroke-dasharray', L);
      const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 1.5 });
      tl.set(line, { attr: { 'stroke-dashoffset': L } }).set(q(svg, '.area'), { opacity: 0 }).set(qa(svg, '.pt'), { scale: 0, transformOrigin: '50% 50%' })
        .set(q(svg, '.tip'), { opacity: 0, y: 6 }).set(qa(svg, '.up'), { opacity: 0 });
      tl.to(line, { attr: { 'stroke-dashoffset': 0 }, duration: 2.2, ease: 'power2.inOut' }, .2)
        .to(q(svg, '.area'), { opacity: 1, duration: 1.2 }, 1)
        .to(qa(svg, '.pt'), { scale: 1, stagger: .22, duration: .3, ease: 'back.out(3)' }, .3)
        .to(q(svg, '.tip'), { opacity: 1, y: 0, duration: .4, ease: 'back.out(2)' }, 2.3)
        .to(qa(svg, '.up'), { opacity: 1, stagger: .15, duration: .3 }, 2.4);
      qa(svg, '.ps').forEach((p, i) => countTo(tl, p, +p.dataset.a, +p.dataset.b, .4 + i * .12, 2, v => '#' + Math.round(v)));
      tl.to({}, { duration: 1.5 });
      return tl;
    },

    /* Partner earnings wallet */
    earn(svg) {
      const gems = [[70, 120], [150, 96], [110, 186], [200, 160], [60, 250], [180, 240]];
      const gem = (x, y) => `<g class="gem" transform="translate(${x} ${y})"><path d="M-12 -6 L-6 -13 L6 -13 L12 -6 L0 12 Z" fill="${C.a2}"/><path d="M-12 -6 H12 L0 12Z" fill="${C.a1}" opacity=".55"/><path d="M-6 -13 L0 -6 L6 -13" fill="none" stroke="#fff" stroke-opacity=".5"/></g>` +
        `<text class="plus" x="${x}" y="${y - 20}" text-anchor="middle" font-size="10" font-weight="700" fill="${C.good}" opacity="0">+$0.15</text>`;
      svg.innerHTML = header('PARTNER WALLET', 'EARNING', C.good) +
        panel(24, 54, 220, 270, 'TASK MAP') +
        [0, 1, 2, 3, 4].map(i => `<line x1="34" y1="${90 + i * 48}" x2="234" y2="${90 + i * 48}" stroke="${C.line}" stroke-dasharray="2 5"/>`).join('') +
        gems.map(([x, y]) => gem(x, y)).join('') +
        panel(256, 54, 180, 128, 'BALANCE · USDT') +
        `<text class="bal" x="268" y="122" font-size="28" font-weight="700" fill="${C.ink}">$14.25</text>` +
        `<text class="tasks" x="268" y="144" font-size="8.5" fill="${C.steel}">14 of 20 daily tasks</text>` +
        `<rect x="268" y="156" width="156" height="6" rx="3" fill="${C.line}"/><rect class="pb" x="268" y="156" width="156" height="6" rx="3" fill="${C.good}"/>` +
        panel(256, 192, 180, 132, 'PAYOUTS') +
        ['Oct 24 · BEP20', 'Oct 17 · BEP20', 'Oct 10 · BEP20'].map((w, i) => `<g class="po" transform="translate(0 ${226 + i * 32})"><rect x="266" y="-14" width="160" height="24" rx="6" fill="${C.bg}" stroke="${C.line}"/>
          ${T(274, 2, w, 8, C.dim)}${T(418, 2, ['$8.40', '$11.25', '$6.90'][i], 8.5, C.good, 'text-anchor="end" font-weight="700"')}</g>`).join('');
      const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 1 });
      const g = qa(svg, '.gem'), p = qa(svg, '.plus');
      tl.set(g, { scale: 1, opacity: 1, transformOrigin: '50% 50%' }).set(p, { opacity: 0, y: 0 }).set(q(svg, '.pb'), { scaleX: .7, transformOrigin: '0% 50%' }).set(q(svg, '.tasks'), { textContent: '14 of 20 daily tasks' });
      tl.from(g, { scale: 0, duration: .45, stagger: .08, ease: 'back.out(2.4)' }, 0)
        .from(qa(svg, '.po'), { opacity: 0, x: 10, stagger: .15, duration: .35 }, .2);
      g.forEach((el, i) => {
        const at = 1 + i * .45;
        tl.to(el, { scale: 1.5, opacity: 0, duration: .3, ease: 'power2.in' }, at)
          .to(p[i], { opacity: 1, y: -14, duration: .5 }, at).to(p[i], { opacity: 0, duration: .3 }, at + .5)
          .set(q(svg, '.tasks'), { textContent: (15 + i) + ' of 20 daily tasks' }, at);
      });
      countTo(tl, q(svg, '.bal'), 14.25, 15.15, 1, 2.7, v => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      tl.to(q(svg, '.pb'), { scaleX: 1, duration: 2.7, ease: 'none' }, 1).to({}, { duration: 1.4 });
      return tl;
    }
  };

  /* =====================================================================
     TOOL PREVIEWS — tiny looping animations on the free-tool cards.
     ===================================================================== */
  const MINIS = {
    bgremove(svg) {
      let checker = '';
      for (let y = 0; y < 9; y++) for (let x = 0; x < 16; x++) if ((x + y) % 2) checker += `<rect x="${x * 20}" y="${y * 20}" width="20" height="20" fill="${C.line}"/>`;
      svg.innerHTML = `<defs><linearGradient id="mbBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f59e0b"/><stop offset="1" stop-color="#ec4899"/></linearGradient>
          <linearGradient id="mbSub" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b82f6"/><stop offset="1" stop-color="#1e40af"/></linearGradient></defs>
        <rect width="320" height="180" fill="${C.panel}"/>${checker}
        <g class="bg"><rect width="320" height="180" fill="url(#mbBg)"/><circle cx="60" cy="48" r="22" fill="#fde68a" opacity=".75"/><path d="M0 150 Q80 110 160 140 T320 120 V180 H0z" fill="#7c2d12" opacity=".4"/></g>
        <g class="sub"><circle cx="160" cy="78" r="26" fill="#fcd9b6"/><path d="M134 72 q26 -36 52 0 q-4 -26 -26 -28 q-22 2 -26 28z" fill="#1f2937"/><path d="M108 180 q4 -70 52 -70 q48 0 52 70z" fill="url(#mbSub)"/></g>
        <rect class="scan" x="0" y="0" width="320" height="3" fill="${C.a2}"/>
        <g class="badge" opacity="0"><rect x="226" y="12" width="82" height="24" rx="12" fill="${C.good}"/><text x="267" y="28" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">✓ PNG ready</text></g>`;
      const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 1 });
      tl.set(q(svg, '.bg'), { opacity: 1 }).set(q(svg, '.scan'), { y: 0, opacity: 1 }).set(q(svg, '.badge'), { opacity: 0, y: -6 })
        .to(q(svg, '.scan'), { y: 177, duration: 1.4, ease: 'power1.inOut' }, .3)
        .to(q(svg, '.bg'), { opacity: 0, duration: .8 }, 1.1)
        .to(q(svg, '.scan'), { opacity: 0, duration: .2 }, 1.7)
        .to(q(svg, '.badge'), { opacity: 1, y: 0, duration: .4, ease: 'back.out(2)' }, 1.8)
        .to({}, { duration: 1.6 });
      return tl;
    },
    optimize(svg) {
      svg.innerHTML = `<defs><linearGradient id="moSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#38bdf8"/><stop offset="1" stop-color="#bae6fd"/></linearGradient></defs>
        <rect width="320" height="180" fill="${C.panel}"/>
        <g><rect x="18" y="18" width="128" height="96" rx="10" fill="url(#moSky)"/><circle cx="120" cy="40" r="10" fill="#fde68a"/>
          <path d="M18 100 L58 64 L86 88 L112 66 L146 96 V114 H18 Z" fill="#0f766e"/></g>
        <g class="fmt"><rect x="18" y="126" width="62" height="22" rx="11" fill="${C.bad}" fill-opacity=".14"/><text class="fmtt" x="49" y="141" text-anchor="middle" font-size="10" font-weight="700" fill="${C.bad}">JPEG</text></g>
        <text x="166" y="36" font-size="10" fill="${C.dim}">File size</text>
        <text class="size" x="166" y="66" font-size="24" font-weight="800" fill="${C.ink}">2.40 MB</text>
        <rect x="166" y="80" width="136" height="8" rx="4" fill="${C.line}"/><rect class="bar" x="166" y="80" width="136" height="8" rx="4" fill="${C.good}"/>
        <text class="save" x="166" y="112" font-size="12" font-weight="700" fill="${C.good}" opacity="0">−92% smaller</text>
        <text x="166" y="140" font-size="10" fill="${C.dim}">Quality</text><rect x="210" y="133" width="92" height="6" rx="3" fill="${C.line}"/>
        <rect x="210" y="133" width="74" height="6" rx="3" fill="${C.a1}"/><circle cx="284" cy="136" r="6" fill="#fff" stroke="${C.a1}" stroke-width="2.5"/>`;
      const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 1 });
      const size = q(svg, '.size');
      tl.set(q(svg, '.bar'), { scaleX: 1, transformOrigin: '0% 50%' }).set(size, { textContent: '2.40 MB' }).set(q(svg, '.save'), { opacity: 0 })
        .set(q(svg, '.fmtt'), { textContent: 'JPEG', attr: { fill: 'var(--s-bad)' } }).set(q(svg, '.fmt rect'), { attr: { fill: 'var(--s-bad)' } })
        .to(q(svg, '.fmt'), { scale: .8, opacity: 0, duration: .2, transformOrigin: '50% 50%' }, .4)
        .set(q(svg, '.fmtt'), { textContent: 'WEBP', attr: { fill: 'var(--s-good)' } }, .6).set(q(svg, '.fmt rect'), { attr: { fill: 'var(--s-good)' } }, .6)
        .to(q(svg, '.fmt'), { scale: 1, opacity: 1, duration: .35, ease: 'back.out(2)' }, .6)
        .to(q(svg, '.bar'), { scaleX: .08, duration: 1.4, ease: 'power3.inOut' }, .6);
      countTo(tl, size, 2400, 186, .6, 1.4, v => v >= 1000 ? (v / 1000).toFixed(2) + ' MB' : Math.round(v) + ' KB');
      tl.to(q(svg, '.save'), { opacity: 1, duration: .3 }, 2).to({}, { duration: 1.8 });
      return tl;
    },
    crop(svg) {
      svg.innerHTML = `<defs><linearGradient id="mcSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a5b4fc"/><stop offset="1" stop-color="#fbcfe8"/></linearGradient></defs>
        <rect width="320" height="180" fill="url(#mcSky)"/><circle cx="230" cy="54" r="18" fill="#fef3c7"/>
        <path d="M0 140 L70 90 L120 122 L190 70 L320 136 V180 H0 Z" fill="#6d28d9" opacity=".55"/><path d="M0 180 L90 132 L170 160 L250 126 L320 158 V180 Z" fill="#4c1d95" opacity=".6"/>
        <path class="mask" fill="#020617" fill-opacity=".5" fill-rule="evenodd" d="M0 0H320V180H0Z M70 0H250V180H70Z"/>
        <rect class="box" x="70" y="0" width="180" height="180" fill="none" stroke="#fff" stroke-width="2"/>
        <g class="lbl"><rect x="252" y="12" width="56" height="22" rx="11" fill="#020617" fill-opacity=".65"/><text class="lt" x="280" y="27" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">1:1</text></g>`;
      const R = [['1:1', 70, 0, 180, 180], ['4:3', 40, 0, 240, 180], ['16:9', 0, 0, 320, 180], ['9:16', 109, 0, 102, 180]];
      const tl = gsap.timeline({ paused: true, repeat: -1 });
      R.forEach(([lab, x, y, w, h], i) => {
        const at = i * 1.3;
        tl.to(q(svg, '.box'), { attr: { x, y, width: w, height: h }, duration: .7, ease: 'power3.inOut' }, at)
          .to(q(svg, '.mask'), { attr: { d: `M0 0H320V180H0Z M${x} ${y}H${x + w}V${y + h}H${x}Z` }, duration: .7, ease: 'power3.inOut' }, at)
          .set(q(svg, '.lt'), { textContent: lab }, at + .35);
      });
      tl.to({}, { duration: .6 });
      return tl;
    }
  };
  function initMinis() {
    $$('[data-mini]').forEach(holder => {
      const build = MINIS[holder.dataset.mini];
      if (!build || holder.__built || !hasGsap) return;
      holder.__built = true;
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 320 180');
      svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      svg.setAttribute('aria-hidden', 'true');
      holder.appendChild(svg);
      const tl = build(svg);
      if (reduce) { tl.progress(.8).pause(); return; }
      ScrollTrigger.create({ trigger: holder, start: 'top 92%', end: 'bottom 5%', onToggle: st => st.isActive ? tl.play() : tl.pause() });
    });
  }

  /* Build every [data-scene] frame */
  const sceneTimelines = new Map();
  function buildScene(holder) {
    const name = holder.dataset.scene;
    if (!SCENES[name] || holder.__built) return null;
    holder.__built = true;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 460 340');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('class', 'scene');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', holder.dataset.label || name);
    holder.appendChild(svg);
    if (!hasGsap) { // static fallback: still renders the composition
      try { SCENES[name].call(null, svg); } catch (e) {}
      return null;
    }
    const tl = SCENES[name](svg);
    if (reduce) { tl.progress(.85).pause(); return tl; }
    sceneTimelines.set(holder, tl);
    return tl;
  }
  window.SEOTIZE_buildScene = buildScene;
  window.SEOTIZE_sceneTl = h => sceneTimelines.get(h);

  function initScenes(only) {
    (only ? [only] : $$('[data-scene]')).forEach(holder => {
      if (holder.closest('.apple-slide')) return; // slider controls these
      const tl = buildScene(holder);
      if (!tl || reduce) return;
      ScrollTrigger.create({ trigger: holder, start: 'top 85%', end: 'bottom 10%', onToggle: s => s.isActive ? tl.play() : tl.pause() });
    });
  }

  /* =====================================================================
     HERO SLIDER (Apple-style): progress bars, arrows, swipe, keyboard.
     ===================================================================== */
  function initHeroSlider() {
    const root = $('#heroSlider');
    if (!root) return;
    const slides = $$('.apple-slide', root), dots = $$('[data-dot]', root), count = $('.slider-count', root);
    const DURATION = 7;
    let cur = 0, prog = null, paused = false;
    slides.forEach(s => { const f = $('[data-scene]', s); if (f) buildScene(f); });
    const tlOf = i => { const f = $('[data-scene]', slides[i]); return f ? sceneTimelines.get(f) : null; };

    function animatePhoto(slide) {
      if (!hasGsap || reduce) return;
      const img = $('.photo-frame img', slide), chips = $$('[data-chip]', slide);
      if (img) gsap.fromTo(img, { scale: 1.14, xPercent: -2 }, { scale: 1, xPercent: 0, duration: DURATION + 1, ease: 'none', overwrite: true });
      if (chips.length) gsap.fromTo(chips, { opacity: 0, y: 18, scale: .9 }, { opacity: 1, y: 0, scale: 1, duration: .7, stagger: .55, delay: .7, ease: 'back.out(1.7)', overwrite: true });
    }
    function setCount(i) { if (count) count.textContent = String(i + 1).padStart(2, '0') + ' / ' + String(slides.length).padStart(2, '0'); }
    function go(n, instant) {
      const prev = cur;
      cur = (n + slides.length) % slides.length;
      setCount(cur);
      dots.forEach((d, i) => {
        d.classList.toggle('active', i === cur);
        d.setAttribute('aria-current', i === cur ? 'true' : 'false');
        const fill = d.firstElementChild;
        if (hasGsap) gsap.set(fill, { scaleX: i < cur ? 1 : 0 }); else fill.style.transform = 'scaleX(' + (i <= cur ? 1 : 0) + ')';
      });
      const a = slides[prev], b = slides[cur];
      if (!hasGsap || reduce || instant) {
        slides.forEach((s, i) => s.classList.toggle('is-active', i === cur));
      } else if (a !== b) {
        gsap.to($$('[data-anim]', a), { opacity: 0, y: -14, duration: .35, stagger: .04, ease: 'power2.in' });
        gsap.to($('.slide-frame', a), { opacity: 0, scale: .97, duration: .45, ease: 'power2.in', onComplete: () => a.classList.remove('is-active') });
        b.classList.add('is-active');
        gsap.fromTo($('.slide-frame', b), { opacity: 0, scale: 1.04, x: 30 }, { opacity: 1, scale: 1, x: 0, duration: .9, ease: 'power3.out', delay: .2 });
        gsap.fromTo($$('[data-anim]', b), { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: .7, stagger: .08, ease: 'power3.out', delay: .35 });
      }
      slides.forEach((s, i) => s.setAttribute('aria-hidden', i === cur ? 'false' : 'true'));
      slides.forEach((s, i) => { s.tabIndex = i === cur ? 0 : -1; });
      animatePhoto(b);
      const pt = tlOf(prev); if (pt && prev !== cur) pt.pause();
      const t = tlOf(cur); if (t && !reduce) t.restart();
      runProgress();
    }
    function runProgress() {
      if (!hasGsap) return;
      if (prog) prog.kill();
      const fill = dots[cur] && dots[cur].firstElementChild;
      if (!fill) return;
      prog = gsap.fromTo(fill, { scaleX: 0 }, { scaleX: 1, duration: DURATION, ease: 'none', onComplete: () => go(cur + 1) });
      if (paused || reduce) prog.pause();
    }
    dots.forEach((d, i) => d.addEventListener('click', e => { e.preventDefault(); go(i); }));
    $('[data-prev]', root)?.addEventListener('click', e => { e.preventDefault(); go(cur - 1); });
    $('[data-next]', root)?.addEventListener('click', e => { e.preventDefault(); go(cur + 1); });
    root.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { paused = true; prog && prog.pause(); } });
    root.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { paused = false; prog && prog.resume(); } });
    root.addEventListener('keydown', e => { if (e.key === 'ArrowRight') go(cur + 1); if (e.key === 'ArrowLeft') go(cur - 1); });
    let sx = 0, sy = 0, swiping = false;
    root.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; swiping = true; }, { passive: true });
    root.addEventListener('touchend', e => {
      if (!swiping) return; swiping = false;
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(cur + (dx < 0 ? 1 : -1));
    }, { passive: true });
    // Pause everything when the hero is off-screen or the tab is hidden
    if (hasGsap) ScrollTrigger.create({ trigger: root, start: 'top bottom', end: 'bottom top', onToggle: s => {
      const t = tlOf(cur);
      if (s.isActive) { if (!paused) prog && prog.resume(); t && !reduce && t.play(); } else { prog && prog.pause(); t && t.pause(); }
    } });
    document.addEventListener('visibilitychange', () => { if (document.hidden) prog && prog.pause(); else if (!paused) prog && prog.resume(); });
    // No intro fade: the first slide is the LCP element and must stay painted from the first frame
    slides[0].classList.add('is-active');
    go(0, true);
  }

  /* ---------------- Boot ---------------- */
  initHeroSlider();
  initReveals();
  // Off-screen scenes are built one per idle slot so no single task gets long
  const idle = window.requestIdleCallback || (f => setTimeout(f, 200));
  const jobs = [...$$('[data-scene]').map(h => () => initScenes(h)), initMinis, () => hasGsap && ScrollTrigger.refresh()];
  const next = () => { const job = jobs.shift(); if (job) { job(); idle(next, { timeout: 1500 }); } };
  idle(next, { timeout: 1500 });
  if (hasGsap) window.addEventListener('load', () => ScrollTrigger.refresh());
})();

/* ---------------------------------------------------------------------------
   Auth page illustrations (login, register, forgot password, partner login).
   Usage: <div class="auth-scene" data-auth-scene="login|register|forgot|partner"></div>
   Each scene is a looping GSAP timeline drawn in SVG; colors follow the page's own
   CSS variables (--primary, --bg, --bg-secondary, --text, --text-light, --border). */
(function () {
  'use strict';
  if (!window.gsap) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const C = {
    card: 'var(--bg-secondary)', bg: 'var(--bg)', ink: 'var(--text)', dim: 'var(--text-light)',
    line: 'var(--border)', p: 'var(--primary)', pd: 'var(--primary-dark)', good: '#10b981', gold: '#f59e0b', bad: '#ef4444', cyan: '#06b6d4'
  };
  const MONO = "font-family=\"'JetBrains Mono',ui-monospace,Menlo,monospace\"";
  const SANS = "font-family=\"'Inter',system-ui,sans-serif\"";
  const T = (x, y, s, size, fill, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${SANS} ${extra}>${s}</text>`;
  const M = (x, y, s, size, fill, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${MONO} ${extra}>${s}</text>`;
  const q = (r, s) => r.querySelector(s), qa = (r, s) => r.querySelectorAll(s);
  const DEFS = `<defs>
    <filter id="asShadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#0f172a" flood-opacity=".18"/></filter>
    <filter id="asGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <linearGradient id="asGem" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#67e8f9"/><stop offset=".5" stop-color="#22d3ee"/><stop offset="1" stop-color="#0891b2"/></linearGradient>
    <linearGradient id="asBrand" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--primary)"/><stop offset="1" stop-color="var(--primary-dark)"/></linearGradient>
  </defs>`;
  function typeTo(tl, node, text, at, dur) {
    const o = { n: 0 };
    tl.to(o, { n: text.length, duration: dur, ease: 'none', onUpdate: () => { node.textContent = text.slice(0, Math.round(o.n)); } }, at);
  }
  function countTo(tl, node, from, to, at, dur, fmt) {
    const o = { v: from };
    tl.to(o, { v: to, duration: dur, ease: 'power2.out', onUpdate: () => { node.textContent = fmt(o.v); } }, at);
  }
  const cursor = (cls = 'cur') => `<g class="${cls}"><path d="M0 0 L0 17 L4.8 12.4 L8.4 20.4 L11.4 19 L7.9 11.2 L14.2 11.2 Z" fill="${C.ink}" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></g>`;
  const browser = (x, y, w, h, url) => `<g filter="url(#asShadow)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${C.card}" stroke="${C.line}"/></g>
    <rect x="${x}" y="${y}" width="${w}" height="30" rx="16" fill="${C.bg}"/><rect x="${x}" y="${y + 18}" width="${w}" height="12" fill="${C.bg}"/>
    <line x1="${x}" y1="${y + 30}" x2="${x + w}" y2="${y + 30}" stroke="${C.line}"/>
    <circle cx="${x + 16}" cy="${y + 15}" r="4" fill="#ef4444"/><circle cx="${x + 29}" cy="${y + 15}" r="4" fill="#f59e0b"/><circle cx="${x + 42}" cy="${y + 15}" r="4" fill="#10b981"/>
    <rect x="${x + 56}" y="${y + 7}" width="${w - 72}" height="16" rx="8" fill="${C.card}" stroke="${C.line}"/>
    ${M(x + 66, y + 18.5, url, 8, C.dim)}`;

  const SCENES = {
    /* Returning user: the dashboard wakes up with fresh numbers */
    login(svg) {
      svg.innerHTML = DEFS + browser(18, 34, 364, 300, '🔒 app.seotize.net/dashboard') +
        `<rect x="18" y="64" width="78" height="270" fill="${C.bg}" opacity=".6"/>
         <g transform="translate(30 80)"><path d="M9 0C16 0 18 2 18 9S16 18 9 18 0 16 0 9 2 0 9 0z" fill="#0b1220"/><path d="M4 12.1l2.9-3.4 2.3 1.8L13.5 5.6" stroke="#22d3ee" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.5 5.6h3v3" stroke="#22d3ee" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>${T(23, 13.5, 'Seotize', 9.5, C.ink, 'font-weight="800"')}</g>
         <rect class="navpill" x="28" y="112" width="58" height="18" rx="6" fill="${C.p}" opacity=".14"/>
         ${['Overview', 'Tasks', 'Images', 'Articles', 'Billing'].map((n, i) => T(36, 125 + i * 26, n, 8.5, i ? C.dim : C.p, i ? '' : 'font-weight="700" class="nav0"')).join('')}
         <text class="hello" x="110" y="90" font-size="13" font-weight="700" fill="${C.ink}" ${SANS}></text>
         ${T(110, 104, 'Here is what changed while you were away', 8, C.dim)}
         ${[0, 1, 2].map(i => `<g class="kpi" transform="translate(${110 + i * 88} 116)"><rect width="80" height="54" rx="10" fill="${C.bg}" stroke="${C.line}"/>
            ${T(10, 17, ['Real visits', 'Keywords', 'Best rank'][i], 7.5, C.dim)}
            <text class="kv" x="10" y="38" font-size="15" font-weight="800" fill="${C.ink}" ${SANS}>0</text>
            <text class="kd" x="72" y="38" text-anchor="end" font-size="7.5" font-weight="700" fill="${C.good}" ${SANS} opacity="0">${['+18%', '+6', '▲ 7'][i]}</text></g>`).join('')}
         <rect x="110" y="180" width="256" height="140" rx="12" fill="${C.bg}" stroke="${C.line}"/>
         ${T(122, 198, 'Traffic · last 30 days', 8.5, C.ink, 'font-weight="700"')}
         ${[0, 1, 2].map(i => `<line x1="122" y1="${226 + i * 28}" x2="354" y2="${226 + i * 28}" stroke="${C.line}" stroke-dasharray="3 4"/>`).join('')}
         <path class="area" d="M122 296 C150 290 160 280 184 284 S220 262 246 260 S288 236 310 226 S344 210 354 204 L354 306 L122 306 Z" fill="${C.p}" fill-opacity=".14"/>
         <path class="chart" d="M122 296 C150 290 160 280 184 284 S220 262 246 260 S288 236 310 226 S344 210 354 204" fill="none" stroke="${C.p}" stroke-width="2.6" stroke-linecap="round"/>
         <circle class="dot" cx="354" cy="204" r="4.5" fill="${C.card}" stroke="${C.p}" stroke-width="2.5"/>
         <g class="toast"><g filter="url(#asShadow)"><rect x="196" y="282" width="178" height="40" rx="12" fill="${C.card}" stroke="${C.line}"/></g>
           <circle cx="216" cy="302" r="10" fill="${C.good}" opacity=".15"/><path d="M211 302 l3.5 3.5 6.5 -7" stroke="${C.good}" stroke-width="2" fill="none" stroke-linecap="round"/>
           ${T(232, 299, '“seo tools” is now #1', 8.5, C.ink, 'font-weight="700"')}${T(232, 311, 'on Google · 2 min ago', 7.5, C.dim)}</g>
         <g class="badge"><rect x="268" y="46" width="98" height="22" rx="11" fill="${C.good}"/>${T(317, 61, '✓ Signed in', 9, '#fff', 'text-anchor="middle" font-weight="700"')}</g>
         ${cursor()}<circle class="rip" r="4" fill="none" stroke="${C.p}" stroke-width="2" opacity="0"/>`;
      const chart = q(svg, '.chart'), L = chart.getTotalLength();
      chart.setAttribute('stroke-dasharray', L);
      const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 1.2 });
      const kv = qa(svg, '.kv'), cur = q(svg, '.cur'), rip = q(svg, '.rip');
      tl.set(chart, { attr: { 'stroke-dashoffset': L } }).set(q(svg, '.area'), { opacity: 0 }).set(q(svg, '.dot'), { scale: 0, transformOrigin: '50% 50%' })
        .set(q(svg, '.toast'), { y: 60, opacity: 0 }).set(q(svg, '.badge'), { opacity: 0, y: -8 }).set(qa(svg, '.kd'), { opacity: 0 })
        .set(cur, { x: 300, y: 360 }).set(rip, { opacity: 0 }).set(q(svg, '.hello'), { textContent: '' });
      tl.to(q(svg, '.badge'), { opacity: 1, y: 0, duration: .45, ease: 'back.out(2)' }, .1);
      typeTo(tl, q(svg, '.hello'), 'Welcome back 👋', .3, .9);
      tl.from(qa(svg, '.kpi'), { y: 14, opacity: 0, stagger: .12, duration: .5, ease: 'power3.out' }, .4);
      countTo(tl, kv[0], 0, 12480, .6, 1.8, v => Math.round(v).toLocaleString('en-US'));
      countTo(tl, kv[1], 0, 64, .7, 1.6, v => Math.round(v));
      countTo(tl, kv[2], 9, 1, .8, 1.8, v => '#' + Math.round(v));
      tl.to(qa(svg, '.kd'), { opacity: 1, stagger: .15, duration: .3 }, 2.3)
        .to(chart, { attr: { 'stroke-dashoffset': 0 }, duration: 2, ease: 'power2.inOut' }, 1)
        .to(q(svg, '.area'), { opacity: 1, duration: 1 }, 2)
        .to(q(svg, '.dot'), { scale: 1, duration: .35, ease: 'back.out(3)' }, 2.9)
        .to(cur, { x: 300, y: 214, duration: 1, ease: 'power2.inOut' }, 2.6)
        .set(rip, { attr: { cx: 302, cy: 216, r: 4 }, opacity: 1 }, 3.6)
        .to(rip, { attr: { r: 24 }, opacity: 0, duration: .6 }, 3.6)
        .to(q(svg, '.toast'), { y: 0, opacity: 1, duration: .6, ease: 'back.out(1.6)' }, 3.8)
        .to(cur, { x: 160, y: 380, duration: .9, ease: 'power2.in' }, 4.4)
        .to({}, { duration: 1.6 });
      return tl;
    },

    /* New user: three onboarding steps, then the site starts climbing */
    register(svg) {
      const step = (i, title, field) => `<g class="step" transform="translate(40 ${70 + i * 82})">
          <g filter="url(#asShadow)"><rect width="320" height="68" rx="14" fill="${C.card}" stroke="${C.line}"/></g>
          <circle class="sc" cx="26" cy="34" r="13" fill="${C.bg}" stroke="${C.line}" stroke-width="1.5"/>
          <text class="sn" x="26" y="38.5" text-anchor="middle" font-size="11" font-weight="800" fill="${C.dim}" ${SANS}>${i + 1}</text>
          <path class="sk" d="M20 34 l4.5 4.5 8 -9" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0"/>
          ${T(50, 24, title, 10, C.ink, 'font-weight="700"')}
          <rect x="50" y="32" width="250" height="24" rx="8" fill="${C.bg}" stroke="${C.line}" class="fld"/>
          ${field}</g>`;
      svg.innerHTML = DEFS +
        `<g class="hdr">${T(40, 46, 'Create your account', 15, C.ink, 'font-weight="800"')}${M(40, 60, 'STEP 1 OF 3', 7.5, C.p, 'class="stepc" letter-spacing="1.5"')}</g>
         <rect x="250" y="40" width="110" height="6" rx="3" fill="${C.line}"/><rect class="bar" x="250" y="40" width="110" height="6" rx="3" fill="${C.p}"/>` +
        step(0, 'Your email', `<text class="t0" x="60" y="48" font-size="9.5" fill="${C.ink}" ${SANS}></text>`) +
        step(1, 'Your website', `<circle class="fav" cx="64" cy="44" r="6" fill="url(#asBrand)" opacity="0"/><text class="t1" x="60" y="48" font-size="9.5" fill="${C.ink}" ${SANS}></text>`) +
        step(2, 'Launch your first SEO task', `<g class="go"><rect x="50" y="32" width="250" height="24" rx="8" fill="url(#asBrand)"/>${T(175, 48, '🚀  Start growing', 9.5, '#fff', 'text-anchor="middle" font-weight="700"')}</g>`) +
        `<g class="result" opacity="0"><g filter="url(#asShadow)"><rect x="40" y="318" width="320" height="56" rx="14" fill="${C.card}" stroke="${C.line}"/></g>
           ${T(56, 340, 'yourbrand.com on Google', 8.5, C.dim)}
           <text class="rank" x="56" y="362" font-size="17" font-weight="800" fill="${C.ink}" ${SANS}>#48</text>
           ${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect class="gb" x="${206 + i * 18}" y="${330 + (7 - i) * 4}" width="11" height="${34 - (7 - i) * 4}" rx="3" fill="${i === 7 ? C.good : C.p}" opacity="${.35 + i * .08}"/>`).join('')}</g>
         <g class="confetti">${Array.from({ length: 18 }, (_, i) => `<rect x="200" y="200" width="${4 + (i % 3)}" height="${7 - (i % 3)}" rx="1.5" fill="${['#2563eb', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'][i % 5]}" opacity="0"/>`).join('')}</g>
         ${cursor()}<circle class="rip" r="4" fill="none" stroke="#fff" stroke-width="2" opacity="0"/>`;
      const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 1.2 });
      const steps = qa(svg, '.step'), cur = q(svg, '.cur'), rip = q(svg, '.rip'), conf = qa(svg, '.confetti rect');
      const done = (i, at) => {
        const g = steps[i];
        tl.to(q(g, '.sc'), { attr: { fill: 'var(--primary)', stroke: 'var(--primary)' }, duration: .25 }, at)
          .to(q(g, '.sn'), { opacity: 0, duration: .15 }, at).to(q(g, '.sk'), { opacity: 1, duration: .2 }, at + .1)
          .fromTo(q(g, '.sc'), { scale: 1, transformOrigin: '50% 50%' }, { scale: 1.25, yoyo: true, repeat: 1, duration: .15 }, at)
          .to(q(svg, '.bar'), { scaleX: (i + 1) / 3, duration: .4, ease: 'power2.out' }, at)
          .set(q(svg, '.stepc'), { textContent: i < 2 ? `STEP ${i + 2} OF 3` : 'ALL SET ✓' }, at + .2);
      };
      tl.set(qa(svg, '.sc'), { attr: { fill: 'var(--bg)', stroke: 'var(--border)' } }).set(qa(svg, '.sn'), { opacity: 1 }).set(qa(svg, '.sk'), { opacity: 0 })
        .set(q(svg, '.bar'), { scaleX: .02, transformOrigin: '0% 50%' }).set([q(svg, '.t0'), q(svg, '.t1')], { textContent: '' })
        .set(q(svg, '.stepc'), { textContent: 'STEP 1 OF 3' }).set(q(svg, '.result'), { opacity: 0, y: 16 }).set(q(svg, '.rank'), { textContent: '#48' })
        .set(q(svg, '.fav'), { opacity: 0 }).set(qa(svg, '.gb'), { scaleY: .1, transformOrigin: '50% 100%' })
        .set(conf, { opacity: 0, x: 0, y: 0, rotate: 0 }).set(cur, { x: 330, y: 380 }).set(rip, { opacity: 0 });
      tl.from(steps, { opacity: 0, x: '-=20', stagger: .12, duration: .5, ease: 'power3.out' }, 0)
        .to(cur, { x: 120, y: 112, duration: .7, ease: 'power2.inOut' }, .3);
      typeTo(tl, q(svg, '.t0'), 'you@yourbrand.com', 1, 1.1);
      done(0, 2.2);
      tl.to(cur, { x: 120, y: 194, duration: .5, ease: 'power2.inOut' }, 2.3)
        .to(q(svg, '.fav'), { opacity: 1, duration: .3 }, 3.6).set(q(svg, '.t1'), { attr: { x: 76 } }, 2.8);
      typeTo(tl, q(svg, '.t1'), 'yourbrand.com', 2.8, .9);
      done(1, 3.9);
      tl.to(cur, { x: 210, y: 278, duration: .55, ease: 'power2.inOut' }, 4)
        .set(rip, { attr: { cx: 212, cy: 280, r: 4 }, opacity: 1 }, 4.6).to(rip, { attr: { r: 28 }, opacity: 0, duration: .5 }, 4.6)
        .fromTo(q(svg, '.go'), { scale: 1, transformOrigin: '50% 50%' }, { scale: .96, yoyo: true, repeat: 1, duration: .1 }, 4.6);
      done(2, 4.8);
      tl.to(q(svg, '.result'), { opacity: 1, y: 0, duration: .5, ease: 'back.out(1.6)' }, 5)
        .to(qa(svg, '.gb'), { scaleY: 1, stagger: .07, duration: .45, ease: 'back.out(1.8)' }, 5.2)
        .to(cur, { x: 360, y: 400, duration: .7 }, 5.1);
      countTo(tl, q(svg, '.rank'), 48, 5, 5.2, 1.6, v => '#' + Math.round(v));
      conf.forEach((c, i) => {
        const a = (i / conf.length) * Math.PI * 2;
        tl.to(c, { opacity: 1, x: Math.cos(a) * (90 + (i % 4) * 25), y: Math.sin(a) * (70 + (i % 3) * 25) - 40, rotate: 360 + i * 40, duration: 1, ease: 'power2.out' }, 5.6)
          .to(c, { opacity: 0, y: '+=40', duration: .6, ease: 'power1.in' }, 6.6);
      });
      tl.to({}, { duration: 1.2 });
      return tl;
    },

    /* Recovery: the email arrives, the code fills in, the lock opens */
    forgot(svg) {
      svg.innerHTML = DEFS +
        `<g transform="translate(110 168)"><g class="env">
           <g filter="url(#asShadow)"><rect width="180" height="120" rx="14" fill="${C.card}" stroke="${C.line}"/></g>
           <g class="letter"><rect x="14" y="8" width="152" height="140" rx="10" fill="${C.bg}" stroke="${C.line}"/>
             ${M(28, 30, 'SEOTIZE · RESET CODE', 7.5, C.p, 'letter-spacing="1.2"')}
             ${[0, 1, 2, 3, 4, 5].map(i => `<rect x="${28 + i * 22}" y="40" width="18" height="24" rx="5" fill="${C.card}" stroke="${C.line}" class="db"/><text class="dg" x="${37 + i * 22}" y="57" text-anchor="middle" font-size="12" font-weight="800" fill="${C.ink}" ${SANS}></text>`).join('')}
             ${T(28, 82, 'Expires in 10 minutes', 7.5, C.dim)}</g>
           <path d="M0 14 Q0 0 14 0 H166 Q180 0 180 14 V106 Q180 120 166 120 H14 Q0 120 0 106 Z" fill="${C.card}" stroke="${C.line}" class="front"/>
           <path class="flap" d="M2 10 L90 72 L178 10" fill="${C.card}" stroke="${C.line}" stroke-width="1.5" stroke-linejoin="round"/>
           <circle cx="90" cy="72" r="11" fill="url(#asBrand)"/><path d="M85 72 h10 M90 67 v10" stroke="#fff" stroke-width="2" stroke-linecap="round" class="seal"/></g></g>
         <g class="lock" transform="translate(200 98)">
           <path class="shackle" d="M-18 0 V-14 a18 18 0 0 1 36 0 V0" fill="none" stroke="${C.p}" stroke-width="7" stroke-linecap="round"/>
           <rect x="-28" y="-2" width="56" height="44" rx="10" fill="url(#asBrand)"/>
           <circle cx="0" cy="17" r="5" fill="#fff"/><rect x="-2" y="18" width="4" height="10" rx="2" fill="#fff"/></g>
         <g class="halo"><circle cx="200" cy="110" r="44" fill="none" stroke="${C.good}" stroke-width="2"/></g>
         <g class="sent"><rect x="122" y="324" width="156" height="26" rx="13" fill="${C.bg}" stroke="${C.line}"/><text class="sentt" x="200" y="341" text-anchor="middle" font-size="9" font-weight="700" fill="${C.dim}" ${SANS}>✉  Code sent to y••@brand.com</text></g>
         <g class="ok" opacity="0"><rect x="112" y="324" width="176" height="26" rx="13" fill="${C.good}"/>${T(200, 341, '✓  Password updated securely', 9, '#fff', 'text-anchor="middle" font-weight="700"')}</g>
         ${Array.from({ length: 10 }, (_, i) => `<circle class="spark" cx="200" cy="110" r="${2 + (i % 3)}" fill="${[C.good, C.cyan, '#f59e0b'][i % 3]}" opacity="0"/>`).join('')}`;
      const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 1.2 });
      const dg = qa(svg, '.dg'), db = qa(svg, '.db'), code = '482916';
      tl.set(q(svg, '.env'), { y: 0, opacity: 1 }).set(q(svg, '.flap'), { scaleY: 1, transformOrigin: '50% 0%' }).set(q(svg, '.letter'), { y: 0 })
        .set(dg, { textContent: '' }).set(db, { attr: { stroke: 'var(--border)' } }).set(q(svg, '.shackle'), { y: 0 })
        .set(q(svg, '.ok'), { opacity: 0, y: 8 }).set(q(svg, '.sent'), { opacity: 1 }).set(q(svg, '.halo'), { opacity: 0, scale: .6, svgOrigin: '200 110' })
        .set(qa(svg, '.spark'), { opacity: 0, x: 0, y: 0 }).set(q(svg, '.lock'), { rotate: 0, svgOrigin: '200 120' });
      tl.from(q(svg, '.env'), { y: 60, opacity: 0, duration: .7, ease: 'back.out(1.5)' }, 0)
        .from(q(svg, '.lock'), { scale: .4, opacity: 0, duration: .6, ease: 'back.out(2)', svgOrigin: '200 120' }, .2)
        .to(q(svg, '.lock'), { rotate: -8, yoyo: true, repeat: 3, duration: .08 }, .9)
        .to(q(svg, '.flap'), { scaleY: -1, duration: .55, ease: 'power2.inOut' }, 1.1)
        .to(q(svg, '.letter'), { y: -86, duration: .8, ease: 'power3.out' }, 1.5);
      [...code].forEach((d, i) => {
        tl.set(dg[i], { textContent: d }, 2.3 + i * .22)
          .to(db[i], { attr: { stroke: 'var(--primary)' }, duration: .1 }, 2.3 + i * .22)
          .from(dg[i], { y: -6, opacity: 0, duration: .2 }, 2.3 + i * .22);
      });
      tl.to(q(svg, '.shackle'), { y: -12, duration: .45, ease: 'back.out(2.5)' }, 3.8)
        .to(q(svg, '.halo'), { opacity: 1, scale: 1.25, duration: .6, ease: 'power2.out' }, 3.8)
        .to(q(svg, '.halo'), { opacity: 0, duration: .4 }, 4.4)
        .to(q(svg, '.sent'), { opacity: 0, duration: .2 }, 4)
        .to(q(svg, '.ok'), { opacity: 1, y: 0, duration: .45, ease: 'back.out(2)' }, 4.1);
      qa(svg, '.spark').forEach((s, i) => {
        const a = i / 10 * Math.PI * 2;
        tl.to(s, { opacity: 1, x: Math.cos(a) * 64, y: Math.sin(a) * 64, duration: .6, ease: 'power2.out' }, 3.9).to(s, { opacity: 0, duration: .3 }, 4.5);
      });
      tl.to({}, { duration: 1.8 });
      return tl;
    },

    /* Partner: collect diamonds on a real-looking website, exactly like a task */
    partner(svg) {
      const gems = [[268, 150], [96, 262], [236, 380], [130, 470]];
      const gem = (x, y, i) => `<g class="gem" data-i="${i}" transform="translate(${x} ${y})">
          <circle class="gglow" r="22" fill="#22d3ee" opacity=".25" filter="url(#asGlow)"/>
          <path d="M-13 -6 L-7 -14 L7 -14 L13 -6 L0 13 Z" fill="url(#asGem)" stroke="#0e7490" stroke-width=".8"/>
          <path d="M-13 -6 H13 M-7 -14 L-3 -6 L0 13 M7 -14 L3 -6 L0 13" stroke="#ecfeff" stroke-opacity=".7" stroke-width=".8" fill="none"/>
          <path d="M-6 -11 L-3 -6" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".9"/></g>`;
      svg.innerHTML = DEFS + browser(18, 24, 364, 352, '🔒 yourclient-site.com/blog/guide') +
        `<clipPath id="asPage"><rect x="19" y="55" width="362" height="320"/></clipPath>
         <g clip-path="url(#asPage)"><g class="page">
           <rect x="19" y="55" width="362" height="34" fill="${C.bg}"/>
           <circle cx="40" cy="72" r="8" fill="#f59e0b"/>${T(54, 76, 'Bloom &amp; Co', 10, C.ink, 'font-weight="800"')}
           ${['Shop', 'Blog', 'About'].map((n, i) => T(250 + i * 40, 76, n, 8, C.dim)).join('')}
           ${T(36, 118, 'The complete guide to', 15, C.ink, 'font-weight="800"')}${T(36, 138, 'indoor plants 🌿', 15, C.ink, 'font-weight="800"')}
           ${[0, 1].map(i => `<rect x="36" y="${150 + i * 10}" width="${[200, 160][i]}" height="5" rx="2.5" fill="${C.line}"/>`).join('')}
           <rect x="36" y="178" width="328" height="70" rx="10" fill="#bbf7d0" opacity=".5"/><path d="M80 238 l30 -32 22 20 16 -14 40 26 Z" fill="#10b981" opacity=".55"/><circle cx="300" cy="200" r="11" fill="#fde68a"/>
           ${[0, 1, 2, 3].map(i => `<rect x="36" y="${262 + i * 11}" width="${[320, 300, 312, 220][i]}" height="5" rx="2.5" fill="${C.line}"/>`).join('')}
           ${[0, 1, 2].map(i => `<rect x="${36 + i * 112}" y="314" width="100" height="84" rx="10" fill="${C.bg}" stroke="${C.line}"/><rect x="${44 + i * 112}" y="322" width="84" height="40" rx="6" fill="${['#fde68a', '#bfdbfe', '#fbcfe8'][i]}" opacity=".7"/><rect x="${44 + i * 112}" y="370" width="70" height="5" rx="2.5" fill="${C.line}"/><rect x="${44 + i * 112}" y="381" width="50" height="5" rx="2.5" fill="${C.line}"/>`).join('')}
           ${[0, 1, 2, 3, 4, 5].map(i => `<rect x="36" y="${414 + i * 11}" width="${[316, 290, 330, 260, 300, 180][i]}" height="5" rx="2.5" fill="${C.line}"/>`).join('')}
           <rect x="36" y="486" width="328" height="44" rx="10" fill="${C.p}" opacity=".1"/>${T(50, 512, 'Subscribe for weekly plant tips', 9, C.ink, 'font-weight="700"')}
           ${gems.map(([x, y], i) => gem(x, y, i)).join('')}
         </g></g>
         <text class="arrow" x="0" y="0" font-size="22" text-anchor="middle">👇</text>
         <g class="hud"><g filter="url(#asShadow)"><rect x="232" y="64" width="140" height="34" rx="17" fill="#0f172a"/></g>
           <path d="M250 75 L253 71 L259 71 L262 75 L256 84 Z" fill="url(#asGem)"/>
           <text class="cnt" x="270" y="85" font-size="10" font-weight="800" fill="#fff" ${SANS}>0/4</text>
           <text class="earn" x="362" y="85" text-anchor="end" font-size="10" font-weight="800" fill="#34d399" ${SANS}>$0.00</text></g>
         <g class="verify" opacity="0"><g filter="url(#asShadow)"><rect x="110" y="168" width="180" height="70" rx="14" fill="${C.card}" stroke="${C.line}"/></g>
           <rect x="124" y="186" width="20" height="20" rx="5" fill="none" stroke="${C.line}" stroke-width="2" class="vbox"/>
           <path class="vtick" d="M128 196 l4 4 8 -9" stroke="${C.good}" stroke-width="2.6" fill="none" stroke-linecap="round" opacity="0"/>
           ${T(152, 200, 'Verify you are human', 9, C.ink, 'font-weight="700"')}${M(124, 226, 'SECURITY CHECK', 7, C.dim, 'letter-spacing="1.2"')}</g>
         <g class="plusPos"><g class="plus" opacity="0">${T(0, 0, '+$0.15', 11, '#10b981', 'text-anchor="middle" font-weight="800"')}</g></g>
         ${Array.from({ length: 8 }, (_, i) => `<circle class="spk" r="${2 + (i % 2)}" fill="${['#22d3ee', '#a5f3fc', '#10b981', '#fbbf24'][i % 4]}" opacity="0"/>`).join('')}
         <g class="win" opacity="0"><g filter="url(#asShadow)"><rect x="90" y="150" width="220" height="110" rx="18" fill="${C.card}" stroke="${C.line}"/></g>
           ${T(200, 190, '🏆', 26, C.ink, 'text-anchor="middle"')}${T(200, 220, 'All diamonds collected!', 11, C.ink, 'text-anchor="middle" font-weight="800"')}
           ${T(200, 240, '+$0.60 added to your wallet', 9, '#10b981', 'text-anchor="middle" font-weight="700"')}</g>
         ${cursor()}<circle class="rip" r="4" fill="none" stroke="#22d3ee" stroke-width="2.5" opacity="0"/>`;
      const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: .8 });
      const page = q(svg, '.page'), cur = q(svg, '.cur'), rip = q(svg, '.rip'), arrow = q(svg, '.arrow'), gEls = qa(svg, '.gem'), spk = qa(svg, '.spk');
      const plus = q(svg, '.plus'), verify = q(svg, '.verify'), cnt = q(svg, '.cnt'), earn = q(svg, '.earn');
      tl.set(page, { y: 0 }).set(gEls, { scale: 0, opacity: 1, transformOrigin: '50% 50%' }).set(arrow, { opacity: 0 })
        .set(cnt, { textContent: '0/4' }).set(earn, { textContent: '$0.00' }).set(q(svg, '.win'), { opacity: 0, scale: .9, svgOrigin: '200 205' })
        .set(cur, { x: 330, y: 360 }).set(rip, { opacity: 0 }).set(verify, { opacity: 0 }).set(q(svg, '.vtick'), { opacity: 0 }).set(spk, { opacity: 0 });
      tl.from(q(svg, '.hud'), { y: -10, opacity: 0, duration: .4 }, 0);
      const scrolls = [0, 0, -150, -250];
      let t = .4;
      gems.forEach(([gx, gy], i) => {
        const sy = scrolls[i], vx = gx, vy = gy + sy; // gem position on screen
        if (i && sy !== scrolls[i - 1]) { tl.to(page, { y: sy, duration: .9, ease: 'power2.inOut' }, t); t += .9; }
        tl.to(gEls[i], { scale: 1, duration: .45, ease: 'back.out(2.6)' }, t)
          .fromTo(q(gEls[i], '.gglow'), { scale: .8, transformOrigin: '50% 50%' }, { scale: 1.25, yoyo: true, repeat: 3, duration: .35 }, t)
          .set(arrow, { attr: { x: vx, y: vy - 26 }, opacity: 1 }, t + .2)
          .fromTo(arrow, { y: 0 }, { y: -7, yoyo: true, repeat: 3, duration: .22, ease: 'sine.inOut' }, t + .2)
          .to(cur, { x: vx + 2, y: vy + 2, duration: .7, ease: 'power2.inOut' }, t + .2)
          .set(rip, { attr: { cx: vx, cy: vy, r: 4 }, opacity: 1 }, t + .95)
          .to(rip, { attr: { r: 26 }, opacity: 0, duration: .45 }, t + .95)
          .set(arrow, { opacity: 0 }, t + .95)
          .to(gEls[i], { scale: 1.5, opacity: 0, duration: .3, ease: 'power2.in' }, t + .95);
        if (i === 0) { // first gem shows the human check, like the real task flow
          tl.to(verify, { opacity: 1, duration: .25 }, t + 1.3)
            .to(cur, { x: 136, y: 198, duration: .45, ease: 'power2.inOut' }, t + 1.35)
            .to(q(svg, '.vtick'), { opacity: 1, duration: .15 }, t + 1.85)
            .to(verify, { opacity: 0, duration: .25 }, t + 2.3);
          t += 1.2;
        }
        spk.forEach((s, k) => {
          const a = k / spk.length * Math.PI * 2;
          tl.set(s, { attr: { cx: vx, cy: vy }, x: 0, y: 0, opacity: 1 }, t + 1)
            .to(s, { x: Math.cos(a) * 26, y: Math.sin(a) * 26, opacity: 0, duration: .5, ease: 'power2.out' }, t + 1);
        });
        tl.set(q(svg, '.plusPos'), { attr: { transform: `translate(${vx} ${vy - 10})` } }, t + 1)
          .set(plus, { opacity: 1, y: 0 }, t + 1)
          .to(plus, { y: -20, opacity: 0, duration: .8, ease: 'power1.out' }, t + 1.1)
          .set(cnt, { textContent: `${i + 1}/4` }, t + 1.2)
          .fromTo(q(svg, '.hud'), { scale: 1, svgOrigin: '302 81' }, { scale: 1.08, yoyo: true, repeat: 1, duration: .12 }, t + 1.2);
        countTo(tl, earn, i * .15, (i + 1) * .15, t + 1.1, .5, v => '$' + v.toFixed(2));
        t += 1.7;
      });
      tl.to(q(svg, '.win'), { opacity: 1, scale: 1, duration: .5, ease: 'back.out(1.8)' }, t)
        .to(cur, { x: 340, y: 380, duration: .8 }, t)
        .to(q(svg, '.win'), { opacity: 0, duration: .35 }, t + 2.2)
        .to(page, { y: 0, duration: .8, ease: 'power2.inOut' }, t + 2.3);
      return tl;
    }
  };

  document.querySelectorAll('[data-auth-scene]').forEach(holder => {
    const build = SCENES[holder.dataset.authScene];
    if (!build) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 400 400');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', holder.getAttribute('aria-label') || 'Animated illustration');
    holder.appendChild(svg);
    const tl = build(svg);
    gsap.from(holder, { opacity: 0, y: 20, scale: .96, duration: .8, ease: 'power3.out' });
    if (reduce) { tl.progress(.7).pause(); return; }
    tl.play();
    document.addEventListener('visibilitychange', () => document.hidden ? tl.pause() : tl.play());
  });
})();
