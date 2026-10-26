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
  window.animLogo = function () {
    if (!hasGsap) return;
    gsap.fromTo('.logo-bar', { scaleY: .3 }, { scaleY: 1, duration: .45, stagger: .09, ease: 'back.out(1.8)', overwrite: true });
  };

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
    $$('.nav-links a').forEach(a => a.classList.toggle('active', a.dataset.key === key));
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
    spy();
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

    /* Request firewall log + shield */
    shield(svg) {
      const ev = [['SQL injection', 'blocked', C.bad], ['Credential stuffing', 'blocked', C.bad], ['Reflected XSS', 'blocked', C.bad], ['TLS 1.3 handshake', 'secure', C.good],
        ['Scraper bot', 'blocked', C.gold], ['Daily backup', 'complete', C.good], ['Path traversal', 'blocked', C.bad]];
      svg.innerHTML = header('REQUEST FIREWALL', 'PROTECTED', C.good) +
        `<clipPath id="shClip"><rect x="24" y="80" width="250" height="236"/></clipPath>` +
        panel(24, 54, 250, 270, 'EVENT LOG') +
        `<g clip-path="url(#shClip)"><g class="ev">` + ev.map(([n, s, col], i) => `<g transform="translate(0 ${96 + i * 30})"><circle cx="38" cy="0" r="3.5" fill="${col}"/>
          ${T(48, 3.5, n, 9, C.ink)}${T(262, 3.5, s.toUpperCase(), 7.5, col, 'text-anchor="end" letter-spacing="1"')}
          <line x1="34" y1="14" x2="264" y2="14" stroke="${C.line}"/></g>`).join('') + `</g></g>` +
        panel(286, 54, 150, 170) +
        `<circle class="ring" cx="361" cy="134" r="30" fill="none" stroke="${C.a1}" stroke-width="1.5"/><circle class="ring" cx="361" cy="134" r="30" fill="none" stroke="${C.a1}" stroke-width="1.5"/>` +
        `<path d="M361 100 l28 10 v20 c0 20 -12 32 -28 40 c-16 -8 -28 -20 -28 -40 v-20z" fill="${C.a1}" fill-opacity=".14" stroke="${C.a1}" stroke-width="2"/>` +
        `<path class="chk" d="M349 134 l8 8 16 -16" fill="none" stroke="${C.good}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="40" stroke-dashoffset="40"/>` +
        T(361, 204, 'ENCRYPTED · SSL/TLS', 8, C.dim, 'text-anchor="middle" letter-spacing="1"') +
        panel(286, 234, 150, 90, 'THREATS BLOCKED') +
        `<text class="cnt" x="296" y="290" font-size="28" font-weight="700" fill="${C.ink}">0</text>` + T(296, 308, 'last 24 hours', 8, C.steel);
      const tl = gsap.timeline({ paused: true, repeat: -1 });
      tl.set(q(svg, '.ev'), { y: 0 }).set(q(svg, '.chk'), { attr: { 'stroke-dashoffset': 40 } });
      tl.from(qa(svg, '.ev > g'), { opacity: 0, x: -10, stagger: .18, duration: .35 }, 0)
        .fromTo(qa(svg, '.ring'), { attr: { r: 30 }, opacity: .8 }, { attr: { r: 64 }, opacity: 0, duration: 1.8, stagger: .9, repeat: 2, ease: 'power1.out' }, 0)
        .to(q(svg, '.chk'), { attr: { 'stroke-dashoffset': 0 }, duration: .6, ease: 'power2.out' }, .6)
        .to(q(svg, '.ev'), { y: -36, duration: 1, ease: 'power2.inOut' }, 2.6)
        .to(q(svg, '.ev'), { y: 0, duration: 1, ease: 'power2.inOut' }, 5);
      countTo(tl, q(svg, '.cnt'), 0, 18402, .2, 3, v => Math.round(v).toLocaleString('en-US'));
      tl.to({}, { duration: .8 });
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
        `<text class="bal" x="268" y="122" font-size="28" font-weight="700" fill="${C.ink}">$0.00</text>` +
        `<text class="tasks" x="268" y="144" font-size="8.5" fill="${C.steel}">0 tasks completed</text>` +
        `<rect x="268" y="156" width="156" height="6" rx="3" fill="${C.line}"/><rect class="pb" x="268" y="156" width="156" height="6" rx="3" fill="${C.good}"/>` +
        panel(256, 192, 180, 132, 'PAYOUTS') +
        ['BEP20 · 0x7a…91f', 'BEP20 · 0x7a…91f', 'BEP20 · 0x7a…91f'].map((w, i) => `<g class="po" transform="translate(0 ${226 + i * 32})"><rect x="266" y="-14" width="160" height="24" rx="6" fill="${C.bg}" stroke="${C.line}"/>
          ${T(274, 2, w, 8, C.dim)}${T(418, 2, ['$42.30', '$38.75', '$51.10'][i], 8.5, C.good, 'text-anchor="end" font-weight="700"')}</g>`).join('');
      const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 1 });
      const g = qa(svg, '.gem'), p = qa(svg, '.plus');
      tl.set(g, { scale: 1, opacity: 1, transformOrigin: '50% 50%' }).set(p, { opacity: 0, y: 0 }).set(q(svg, '.pb'), { scaleX: 0, transformOrigin: '0% 50%' });
      tl.from(g, { scale: 0, duration: .45, stagger: .08, ease: 'back.out(2.4)' }, 0)
        .from(qa(svg, '.po'), { opacity: 0, x: 10, stagger: .15, duration: .35 }, .2);
      g.forEach((el, i) => {
        const at = 1 + i * .45;
        tl.to(el, { scale: 1.5, opacity: 0, duration: .3, ease: 'power2.in' }, at)
          .to(p[i], { opacity: 1, y: -14, duration: .5 }, at).to(p[i], { opacity: 0, duration: .3 }, at + .5)
          .set(q(svg, '.tasks'), { textContent: (i + 1) + ' tasks completed' }, at);
      });
      countTo(tl, q(svg, '.bal'), 0, 1248.4, 1, 2.7, v => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      tl.to(q(svg, '.pb'), { scaleX: 1, duration: 2.7, ease: 'none' }, 1).to({}, { duration: 1.4 });
      return tl;
    }
  };

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

  function initScenes() {
    $$('[data-scene]').forEach(holder => {
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

    function setCount(i) { if (count) count.textContent = String(i + 1).padStart(2, '0') + ' / ' + String(slides.length).padStart(2, '0'); }
    function go(n, instant) {
      const prev = cur;
      cur = (n + slides.length) % slides.length;
      setCount(cur);
      dots.forEach((d, i) => {
        d.classList.toggle('active', i === cur);
        d.setAttribute('aria-current', i === cur ? 'true' : 'false');
        const fill = d.firstElementChild;
        if (hasGsap) gsap.set(fill, { width: i < cur ? '100%' : '0%' }); else fill.style.width = i <= cur ? '100%' : '0%';
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
      const pt = tlOf(prev); if (pt && prev !== cur) pt.pause();
      const t = tlOf(cur); if (t && !reduce) t.restart();
      runProgress();
    }
    function runProgress() {
      if (!hasGsap) return;
      if (prog) prog.kill();
      const fill = dots[cur] && dots[cur].firstElementChild;
      if (!fill) return;
      prog = gsap.fromTo(fill, { width: '0%' }, { width: '100%', duration: DURATION, ease: 'none', onComplete: () => go(cur + 1) });
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
    // Intro
    slides[0].classList.add('is-active');
    if (hasGsap && !reduce) {
      gsap.from(root, { opacity: 0, y: 30, scale: .985, duration: 1.1, ease: 'power3.out' });
      gsap.from($$('[data-anim]', slides[0]), { opacity: 0, y: 24, duration: .8, stagger: .1, ease: 'power3.out', delay: .35 });
      gsap.from($('.slide-frame', slides[0]), { opacity: 0, x: 40, duration: 1.1, ease: 'power3.out', delay: .25 });
      gsap.from($('.slider-ui', root), { opacity: 0, y: 12, duration: .7, delay: .8 });
    }
    go(0, true);
  }

  /* ---------------- Boot ---------------- */
  initHeroSlider();
  initScenes();
  initReveals();
  setTimeout(window.animLogo, 250);
  if (hasGsap) window.addEventListener('load', () => ScrollTrigger.refresh());
})();
