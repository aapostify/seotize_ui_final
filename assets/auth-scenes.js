/* SEOTIZE — animated illustrations for the sign-in / sign-up pages.
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
         <g transform="translate(32 82)"><rect x="0" y="8" width="4" height="8" rx="1" fill="${C.p}" opacity=".55"/><rect x="6" y="4" width="4" height="12" rx="1" fill="${C.p}" opacity=".8"/><rect x="12" y="0" width="4" height="16" rx="1" fill="${C.p}"/>${T(22, 14, 'SEOTIZE', 9, C.ink, 'font-weight="800"')}</g>
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
