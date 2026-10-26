// SEOTIZE Tools — single-file Cloudflare Worker serving /tools/*
// Route:    seotize.net/tools*
// Bindings: Workers AI → "AI" · Images → "IMAGES" · Variable → "TURNSTILE_SITE_KEY" · Secret → "TURNSTILE_SECRET_KEY"
// Pages share the site design via /assets/site.css + /assets/site.js (served by the static site on the same origin).

const MAX = 25 * 1048576;
const FORMATS = { jpeg: 'image/jpeg', webp: 'image/webp', avif: 'image/avif', png: 'image/png' };

const TOOLS = [
  {
    slug: 'ai-background-remover', icon: 'ri-magic-line', tag: 'AI', pill: 'AI-powered',
    name: 'AI Background Remover',
    desc: 'Remove the background from any photo with AI and download a clean transparent PNG.',
    title: 'AI Background Remover — Free Transparent PNG',
    sub: 'Our AI finds the subject in your photo and removes the background in seconds. Download a clean, transparent PNG ready for products, profiles and ads.'
  },
  {
    slug: 'image-optimizer', icon: 'ri-speed-up-line', tag: 'Fast', pill: 'SEO speed boost',
    name: 'Image Optimizer',
    desc: 'Compress and convert images to WebP, AVIF, JPEG or PNG to make your pages load faster.',
    title: 'Image Optimizer — Compress & Convert to WebP/AVIF',
    sub: 'Shrink image file size without visible quality loss. Convert to WebP or AVIF and help your pages load faster for better SEO.'
  },
  {
    slug: 'image-crop', icon: 'ri-crop-line', tag: 'Free', pill: 'Precise cropping',
    name: 'Image Crop',
    desc: 'Crop images freely or to popular aspect ratios like 1:1, 4:3, 16:9 and 9:16.',
    title: 'Image Crop — Crop Photos Online',
    sub: 'Drag to select the area you want, pick an aspect ratio, and download the cropped image in seconds.'
  }
];

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (req.method === 'POST') {
      const api = API[path];
      if (!api) return err('Not found', 404);
      if (+req.headers.get('content-length') > MAX + 2097152) return err('Max file size is 25 MB', 413);
      const bad = await verify(req, env);
      if (bad) return bad;
      try {
        return await api(req, env);
      } catch (e) {
        return err(e.message || 'Processing failed');
      }
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return err('Method not allowed', 405);
    if (path === '/tools') return render(url, env, {
      path, title: 'Free SEO & Image Tools', pill: 'Free tools', icon: 'ri-tools-line', h1: 'Free SEO & Image Tools',
      sub: 'Fast, free tools powered by AI and a global network. No sign-up needed.',
      desc: 'Free online tools by SEOTIZE: AI background remover, image optimizer and image crop.'
    });
    const t = TOOLS.find(x => '/tools/' + x.slug === path);
    if (t) return render(url, env, { path, tool: t, title: t.title, pill: t.pill, icon: t.icon, h1: t.name, sub: t.sub, desc: t.desc });
    return render(url, env, {
      path: '/tools', title: 'Page not found', pill: '404', icon: 'ri-error-warning-line', h1: 'Tool not found',
      sub: 'This tool does not exist. Try one of our free tools below.', desc: 'Page not found'
    }, 404);
  }
};

// ---------- API ----------

const API = {
  '/tools/api/remove-bg': removeBg,
  '/tools/api/optimize': optimize,
  '/tools/api/crop': crop
};

const err = (error, status = 500) => Response.json({ error }, { status, headers: { 'cache-control': 'no-store' } });

async function verify(req, env) {
  if (!env.TURNSTILE_SECRET_KEY) return err('Missing secret "TURNSTILE_SECRET_KEY"');
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: req.headers.get('x-turnstile') || '',
      remoteip: req.headers.get('CF-Connecting-IP') || ''
    })
  }).then(r => r.json()).catch(() => ({}));
  return r.success ? null : err('Verification failed, please try again', 403);
}

async function removeBg(req, env) {
  if (!env.AI) return err('Missing Workers AI binding "AI"');
  const image = await req.text();
  if (!/^data:image\/(jpeg|png);base64,/.test(image)) return err('Only JPEG or PNG is supported', 415);
  const r = await env.AI.run('bria/remove-background', { image });
  const out = r?.image || r?.result?.image;
  if (!out) return err('Model returned no image');
  const body = out.startsWith('http')
    ? await fetch(out).then(p => { if (!p.ok) throw new Error('Could not fetch the result image'); return p.body; })
    : Uint8Array.from(atob(out.split(',').pop()), c => c.charCodeAt(0));
  return new Response(body, { headers: { 'content-type': 'image/png', 'cache-control': 'no-store' } });
}

async function readFile(req, env) {
  if (!env.IMAGES) throw new Error('Missing Images binding "IMAGES"');
  let form;
  try { form = await req.formData(); } catch { throw new Error('Bad upload'); }
  const file = form.get('file');
  if (!file || typeof file === 'string') throw new Error('No file uploaded');
  if (file.size > MAX) throw new Error('Max file size is 25 MB');
  return { form, file };
}

async function output(img, type, quality) {
  try {
    const out = (await img.output({ format: type, quality })).response();
    return new Response(out.body, { headers: { 'content-type': type, 'cache-control': 'no-store' } });
  } catch {
    return err('Could not read this image', 400);
  }
}

async function optimize(req, env) {
  const { form, file } = await readFile(req, env);
  const type = FORMATS[form.get('format')] || FORMATS.webp;
  const quality = Math.min(100, Math.max(1, parseInt(form.get('quality')) || 80));
  return output(env.IMAGES.input(file.stream()), type, quality);
}

async function crop(req, env) {
  const { form, file } = await readFile(req, env);
  const [left, top, width, height] = ['left', 'top', 'width', 'height'].map(k => Math.max(0, parseInt(form.get(k)) || 0));
  if (!width || !height) return err('Invalid crop area', 400);
  const type = FORMATS[form.get('format')] || (Object.values(FORMATS).includes(file.type) ? file.type : FORMATS.png);
  return output(env.IMAGES.input(file.stream()).transform({ trim: { left, top, width, height } }), type, 92);
}

// ---------- Page ----------

const GRADS = { 'ai-background-remover': 'linear-gradient(135deg,#2563eb,#1e40af)', 'image-optimizer': 'linear-gradient(135deg,#06b6d4,#0e7490)', 'image-crop': 'linear-gradient(135deg,#10b981,#047857)' };

function render(url, env, o, status = 200) {
  const t = o.tool;
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${o.title} | SEOTIZE</title>
<meta name="description" content="${o.desc}">
<link rel="canonical" href="${url.origin}${o.path}">
<meta property="og:title" content="${o.title} | SEOTIZE"><meta property="og:description" content="${o.desc}"><meta property="og:type" content="website">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://cdnjs.cloudflare.com">
<link rel="dns-prefetch" href="https://cdn.jsdelivr.net">
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@800&family=Outfit:wght@500;600;700;800;900&family=JetBrains+Mono:wght@500;600&display=swap" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@800&family=Outfit:wght@500;600;700;800;900&family=JetBrains+Mono:wght@500;600&display=swap"></noscript>
<link rel="preload" as="style" href="https://cdn.jsdelivr.net/npm/remixicon@4.0.0/fonts/remixicon.css" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/remixicon@4.0.0/fonts/remixicon.css"></noscript>
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#0b1222">
<link rel="stylesheet" href="/assets/site.css">
${t ? '<script data-cfasync="false" src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=tsInit" async defer></script>' : ''}
<style>${CSS}</style>
</head><body><!--email_off-->
<script data-cfasync="false">try{localStorage.getItem('theme')==='dark'&&document.body.classList.add('dark')}catch(e){}</script>
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="seo-g" x1="7" y1="22" x2="24" y2="10" gradientUnits="userSpaceOnUse"><stop stop-color="#818cf8"/><stop offset="1" stop-color="#22d3ee"/></linearGradient><linearGradient id="seo-gd" x1="7" y1="22" x2="24" y2="10" gradientUnits="userSpaceOnUse"><stop stop-color="#4f46e5"/><stop offset="1" stop-color="#0891b2"/></linearGradient></defs></svg>
${NAV}
<main>
  <section class="page-hero thero${t ? ' is-tool' : ''}">
    <div class="grid-bg"></div>
    <div class="blur-orb" style="background:var(--primary);width:420px;height:420px;top:-160px;right:-120px"></div>
    <div class="blur-orb" style="background:var(--accent);width:300px;height:300px;top:40px;left:-150px"></div>
    <div class="container">
      ${t ? `<nav class="crumb" aria-label="Breadcrumb"><a href="/tools">Tools</a><i class="ri-arrow-right-s-line"></i><span>${t.name}</span></nav>` : ''}
      <span class="eyebrow" data-reveal><i class="${o.icon}"></i>${o.pill}</span>
      <h1 data-reveal>${o.h1}</h1>
      <p data-reveal>${o.sub}</p>
      ${t ? '' : '<div class="trust-row" data-reveal><span><i class="ri-shield-check-line"></i>Private</span><span><i class="ri-flashlight-line"></i>Global network</span><span><i class="ri-user-unfollow-line"></i>No sign-up</span></div>'}
    </div>
  </section>
  <div class="container">
  ${t
    ? `<div class="tool card" data-reveal>
         <div class="tool-head"><div class="ticon" style="background:${GRADS[t.slug]}"><i class="${t.icon}"></i></div><div><b>${t.name}</b><small>${t.pill}</small></div><span class="chip">${t.tag}</span></div>
         <div class="tool-body">${BODY[t.slug](env.TURNSTILE_SITE_KEY || '')}</div>
       </div>
       <div class="perks" data-stagger>
         <div><i class="ri-lock-2-line"></i><b>Private</b><span>Files are processed and never stored.</span></div>
         <div><i class="ri-flashlight-line"></i><b>Fast</b><span>Runs on a global edge network.</span></div>
         <div><i class="ri-hand-heart-line"></i><b>Free</b><span>No sign-up, no watermark.</span></div>
       </div>
       <section class="more"><div class="section-head"><span class="eyebrow"><span class="dot"></span>Keep going</span><h2>More free tools</h2></div><div class="tools-grid two" data-stagger>${TOOLS.filter(x => x !== t).map(card).join('')}</div></section>`
    : `<div class="tools-grid" data-stagger>${TOOLS.map(card).join('')}</div>
       <section class="more"><div class="cta-band"><span class="eyebrow" style="color:#93c5fd"><span class="dot"></span>Need more than tools?</span><h2 style="margin-top:1rem">Grow with real people, not bots.</h2><p>SEOTIZE combines real user engagement, AI content and a global CDN to lift your rankings.</p><div class="cta-buttons"><a href="/connect.html" class="btn btn-light btn-lg">Get Started Free <i class="ri-arrow-right-line"></i></a><a href="/#features" class="btn btn-outline-light btn-lg">See features</a></div></div></section>`}
  </div>
</main>
${FOOTER}${MNAV}
<script data-cfasync="false" defer src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
<script data-cfasync="false" defer src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js"></script>
<script data-cfasync="false" defer src="/assets/site.js"></script>
<script data-cfasync="false">${COMMON}${t ? TOOLJS + SCRIPT[t.slug] : ''}</script>
<!--/email_off--></body></html>`;
  return new Response(html, { status, headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'no-cache' } });
}

const MINI = { 'ai-background-remover': ['bgremove', 'ri-timer-flash-line', 'Ready in seconds'], 'image-optimizer': ['optimize', 'ri-arrow-down-circle-line', 'Up to 90% smaller'], 'image-crop': ['crop', 'ri-aspect-ratio-line', '5 aspect ratios'] };

const card = t => `<a class="card tool-card" href="/tools/${t.slug}"><div class="tool-preview" data-mini="${MINI[t.slug][0]}"><span class="chip tag">${t.tag}</span></div><div class="tool-body"><h3>${t.name}</h3><p>${t.desc}</p><div class="tool-foot"><span class="tool-stat"><i class="${MINI[t.slug][1]}"></i>${MINI[t.slug][2]}</span><span class="go">Open tool <i class="ri-arrow-right-line"></i></span></div></div></a>`;

const DROP = hint => `<label class="drop" id="drop"><input type="file" id="file" accept="image/*" hidden><div class="dicon"><i class="ri-upload-cloud-2-line"></i></div><b>Drop your image here</b><small>or <u>click to browse</u> · ${hint}</small><span class="paste-hint"><i class="ri-clipboard-line"></i>You can also paste an image</span></label>`;

const PROG = steps => `<div class="view" id="prog"><div class="row"><b id="lbl">Uploading…</b><span id="pct">0%</span></div><div class="bar"><div class="fill" id="fill"></div></div><div class="steps">${steps.map((s, i) => `<div class="st" id="s${i}"><i></i>${s}</div>`).join('')}</div><div class="thumb"><img id="pv" alt=""><div class="scan"></div></div></div>`;

const DL = label => `<a class="btn btn-primary btn-lg wide" id="dl"><i class="ri-download-2-line"></i>${label}</a>`;

const AGAIN = `<button class="btn btn-ghost wide again" type="button" onclick="location.reload()"><i class="ri-refresh-line"></i>Process another image</button>`;

const END = (key, res) => `<div class="view" id="res"><div class="res-badge"><i class="ri-checkbox-circle-fill"></i>Done</div><img id="r" class="checker" alt="Result">${res}${AGAIN}</div><div class="errm" id="errm" role="alert"></div><div class="tsw" id="tsw"><div id="ts" data-sitekey="${key}"></div></div>`;

const BODY = {
  'ai-background-remover': k => `<div class="view" id="up" style="display:block">${DROP('JPG, PNG, WEBP · up to 25 MB')}</div>${PROG(['Upload', 'AI removing background', 'Finish'])}${END(k, DL('Download PNG'))}`,
  'image-optimizer': k => `<div class="view" id="up" style="display:block">${DROP('JPG, PNG, WEBP, AVIF, GIF · up to 25 MB')}</div>
    <div class="view" id="edit"><img id="op" class="checker prev" alt="">
      <div class="est"><span>Original<b id="fn"></b></span><span>New size<b id="es">…</b></span></div>
      <div class="opts center">
        <label>Format<select id="fmt"><option value="webp">WebP</option><option value="avif">AVIF</option><option value="jpeg">JPEG</option><option value="png">PNG</option></select></label>
        <label>Quality: <b id="qv">80</b><input type="range" id="q" min="1" max="100" value="80"></label></div>
      <button class="btn btn-primary btn-lg wide" id="go"><i class="ri-speed-up-line"></i>Optimize image</button>
    </div>${PROG(['Upload', 'Optimizing', 'Finish'])}${END(k, `<div class="stats"><div><small>Original</small><b id="o1"></b></div><div><small>Optimized</small><b id="o2"></b></div><div><small>Saved</small><b id="o3"></b></div></div>${DL('Download image')}`)}`,
  'image-crop': k => `<div class="view" id="up" style="display:block">${DROP('JPG, PNG, WEBP, AVIF · up to 25 MB')}</div>
    <div class="view" id="edit">
      <div class="ratios" id="ratios"><button class="on" data-r="0">Free</button><button data-r="1">1:1</button><button data-r="1.3333">4:3</button><button data-r="1.7778">16:9</button><button data-r="0.5625">9:16</button></div>
      <div class="stage"><img id="ci" alt=""><div class="cbox" id="cb"><i data-h="nw"></i><i data-h="ne"></i><i data-h="sw"></i><i data-h="se"></i></div></div>
      <div class="opts center"><span class="dim" id="cw"></span><label>Format<select id="fmt"><option value="">Same as original</option><option value="png">PNG</option><option value="jpeg">JPEG</option><option value="webp">WebP</option></select></label></div>
      <button class="btn btn-primary btn-lg wide" id="go"><i class="ri-crop-line"></i>Crop image</button>
    </div>${PROG(['Upload', 'Cropping', 'Finish'])}${END(k, DL('Download image'))}`
};

// ---------- Client scripts (raw strings: no backticks / no ${}) ----------

// Theme toggle + logo animation come from /assets/site.js.
const COMMON = String.raw`
const $=id=>document.getElementById(id);
`;

const TOOLJS = String.raw`
let tok='',busy=0,timer,url,FV='up';
const offTs=()=>{tok=''};
// The widget is rendered inside #tsw; pick the compact size whenever the box is narrower than the
// 300px "flexible" minimum so it never overflows and always stays centred.
window.tsInit=()=>turnstile.render('#ts',{sitekey:$('ts').dataset.sitekey,theme:document.body.classList.contains('dark')?'dark':'light',size:$('tsw').clientWidth<310?'compact':'flexible','refresh-expired':'auto',callback:t=>{tok=t},'expired-callback':offTs,'error-callback':offTs});
const base=f=>(f.name||'image').replace(/\.[^.]+$/,''),kb=n=>n>=1048576?(n/1048576).toFixed(2)+' MB':(n/1024).toFixed(1)+' KB';
function view(v){['up','edit','prog','res'].forEach(k=>{const e=$(k);if(e)e.style.display=k==v?'block':'none'});$('tsw').style.display=v=='up'||v=='edit'?'flex':'none';
  const e=$(v);if(e&&window.gsap)gsap.fromTo(e,{opacity:0,y:14},{opacity:1,y:0,duration:.45,ease:'power3.out'})}
function step(i){for(let k=0;k<3;k++)$('s'+k).className='st'+(k<i?' ok':k==i?' act':'')}
function setP(p,l){p=Math.min(100,p);$('fill').style.width=p+'%';$('pct').textContent=Math.round(p)+'%';if(l)$('lbl').textContent=l}
function fail(m){clearInterval(timer);busy=0;$('errm').innerHTML='<i class="ri-error-warning-line"></i>'+m;$('errm').style.display='flex';view(FV);$('file').value='';
  if(window.gsap)gsap.fromTo('#errm',{x:-8},{x:0,duration:.5,ease:'elastic.out(1,.3)'})}
function check(f,needTok){$('errm').style.display='none';if(busy)return 0;
  if(!f.type.startsWith('image/'))return fail('Please choose an image file'),0;
  if(f.size>26214400)return fail('Max file size is 25 MB'),0;
  if(needTok&&!tok)return fail('Please complete the verification below first'),0;return 1}
function bindDrop(cb){const d=$('drop');
  ['dragenter','dragover'].forEach(e=>d.addEventListener(e,v=>{v.preventDefault();d.classList.add('on')}));
  ['dragleave','drop'].forEach(e=>d.addEventListener(e,v=>{v.preventDefault();d.classList.remove('on')}));
  d.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];f&&cb(f)});
  $('file').onchange=e=>{const f=e.target.files[0];f&&cb(f)};
  addEventListener('paste',e=>{if($('up').style.display=='none')return;const it=[...(e.clipboardData||{}).items||[]].find(x=>x.type.startsWith('image/'));const f=it&&it.getAsFile();f&&cb(f)})}
function send(path,body,proc,done){
  busy=1;view('prog');step(0);setP(0,'Uploading…');
  const x=new XMLHttpRequest(),bad=m=>{tok='';window.turnstile&&turnstile.reset();fail(m)};
  x.open('POST',path);x.responseType='blob';x.timeout=120000;x.setRequestHeader('x-turnstile',tok);
  x.upload.onprogress=e=>{e.lengthComputable&&setP(e.loaded/e.total*35)};
  x.upload.onload=()=>{step(1);let p=35;setP(p,proc);timer=setInterval(()=>setP(p+=(90-p)*.04),200)};
  x.onprogress=e=>{if(e.lengthComputable&&e.loaded){clearInterval(timer);step(2);setP(90+e.loaded/e.total*10,'Finishing…')}};
  x.onerror=()=>bad('Network error, please try again');x.ontimeout=()=>bad('Request timed out, please try again');
  x.onload=async()=>{clearInterval(timer);
    if(x.status!=200){let m='Server error '+x.status;try{m=JSON.parse(await x.response.text()).error||m}catch(e){}return bad(m)}
    step(3);setP(100,'Done');done(x)};
  x.send(body)}
function showResult(b,name){if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(b);const r=$('r');
  r.onload=()=>setTimeout(()=>{view('res');busy=0;if(window.gsap){gsap.from('#r',{scale:.94,opacity:0,duration:.6,ease:'back.out(1.6)'});gsap.from('.res-badge',{y:-10,opacity:0,duration:.5,delay:.2})}},300);r.onerror=()=>fail('Result could not be displayed');
  r.src=url;$('dl').href=url;$('dl').download=name}
`;

const SCRIPT = {
  'ai-background-remover': String.raw`
async function prep(f){const im=await createImageBitmap(f),k=Math.min(1,2048/Math.max(im.width,im.height)),c=document.createElement('canvas');
  c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);im.close();
  return c.toDataURL(f.type=='image/jpeg'?'image/jpeg':'image/png',.92)}
bindDrop(async f=>{if(!check(f,1))return;busy=1;let d;
  try{d=await prep(f)}catch(e){return fail('This image format is not supported')}
  $('pv').src=d;send('/tools/api/remove-bg',d,'AI is removing the background…',x=>showResult(x.response,base(f)+'-nobg.png'))});
`,
  'image-optimizer': String.raw`
let F,est;const op=$('op'),cv=document.createElement('canvas');
const pct=(a,b)=>b<=a?'<em class="good">−'+Math.round((1-b/a)*100)+'% smaller</em>':'<em class="bad">+'+Math.round((b/a-1)*100)+'% bigger</em>';
function estimate(){clearTimeout(est);$('es').textContent='…';est=setTimeout(()=>{const t='image/'+$('fmt').value;
  cv.toBlob(b=>{$('es').innerHTML=b&&b.type==t?kb(b.size)+' '+pct(F.size,b.size):'shown after optimizing'},t,$('q').value/100)},250)}
$('q').oninput=e=>{$('qv').textContent=e.target.value;estimate()};$('fmt').onchange=estimate;
bindDrop(f=>{if(!check(f,0))return;F=f;$('fn').textContent=kb(f.size);
  op.onload=()=>{cv.width=op.naturalWidth;cv.height=op.naturalHeight;cv.getContext('2d').drawImage(op,0,0);FV='edit';view('edit');estimate()};
  op.onerror=()=>fail('This image format is not supported');
  if(op.src)URL.revokeObjectURL(op.src);op.src=URL.createObjectURL(f)});
$('go').onclick=()=>{if(busy)return;$('errm').style.display='none';
  if(!tok)return fail('Please complete the verification below first');
  const fmt=$('fmt').value,fd=new FormData();fd.append('file',F);fd.append('format',fmt);fd.append('quality',$('q').value);$('pv').src=op.src;
  send('/tools/api/optimize',fd,'Optimizing your image…',x=>{const a=F.size,b=x.response.size;
    $('o1').textContent=kb(a);$('o2').textContent=kb(b);$('o3').innerHTML=pct(a,b);
    showResult(x.response,base(F)+'.'+(fmt=='jpeg'?'jpg':fmt))})};
`,
  'image-crop': String.raw`
let F,C={x:0,y:0,w:0,h:0},ratio=0,drag=null;const ci=$('ci'),cb=$('cb'),cl=(v,a,b)=>Math.min(Math.max(v,a),b);
function draw(){const s=cb.style,k=ci.naturalWidth/ci.clientWidth;s.left=C.x+'px';s.top=C.y+'px';s.width=C.w+'px';s.height=C.h+'px';
  $('cw').textContent=Math.round(C.w*k)+' × '+Math.round(C.h*k)+' px'}
function initBox(){const W=ci.clientWidth,H=ci.clientHeight;let w=W*.8,h=H*.8;
  if(ratio){if(w/h>ratio)w=h*ratio;else h=w/ratio}C={x:(W-w)/2,y:(H-h)/2,w:w,h:h};draw()}
bindDrop(f=>{if(!check(f,0))return;F=f;
  ci.onload=()=>{FV='edit';view('edit');initBox()};ci.onerror=()=>fail('This image format is not supported');
  if(ci.src)URL.revokeObjectURL(ci.src);ci.src=URL.createObjectURL(f)});
$('ratios').onclick=e=>{const b=e.target.closest('button');if(!b)return;ratio=+b.dataset.r;
  document.querySelectorAll('#ratios button').forEach(x=>x.classList.toggle('on',x==b));initBox()};
addEventListener('resize',()=>{if(F&&$('edit').style.display=='block')initBox()});
cb.onpointerdown=e=>{e.preventDefault();cb.setPointerCapture(e.pointerId);drag={h:e.target.dataset.h||'m',sx:e.clientX,sy:e.clientY,o:Object.assign({},C)}};
cb.onpointermove=e=>{if(!drag)return;const o=drag.o,h=drag.h,dx=e.clientX-drag.sx,dy=e.clientY-drag.sy,W=ci.clientWidth,H=ci.clientHeight;
  if(h=='m'){C.x=cl(o.x+dx,0,W-o.w);C.y=cl(o.y+dy,0,H-o.h);return draw()}
  const L=h.includes('w'),T=h.includes('n'),ax=L?o.x+o.w:o.x,ay=T?o.y+o.h:o.y;
  let nw=L?ax-cl(o.x+dx,0,ax-24):cl(o.x+o.w+dx,ax+24,W)-ax,nh=T?ay-cl(o.y+dy,0,ay-24):cl(o.y+o.h+dy,ay+24,H)-ay;
  if(ratio){if(nw/nh>ratio)nw=nh*ratio;else nh=nw/ratio}
  const mw=L?ax:W-ax,mh=T?ay:H-ay;
  if(nw>mw){nw=mw;if(ratio)nh=nw/ratio}if(nh>mh){nh=mh;if(ratio)nw=nh*ratio}
  C={x:L?ax-nw:ax,y:T?ay-nh:ay,w:nw,h:nh};draw()};
cb.onpointerup=cb.onpointercancel=()=>{drag=null};
$('go').onclick=()=>{if(busy)return;$('errm').style.display='none';
  if(!tok)return fail('Please complete the verification below first');
  const k=ci.naturalWidth/ci.clientWidth,N=v=>Math.round(v*k),l=N(C.x),t=N(C.y),fd=new FormData();
  fd.append('file',F);fd.append('left',l);fd.append('top',t);
  fd.append('width',Math.max(1,Math.min(N(C.w),ci.naturalWidth-l)));fd.append('height',Math.max(1,Math.min(N(C.h),ci.naturalHeight-t)));
  fd.append('format',$('fmt').value);$('pv').src=ci.src;
  send('/tools/api/crop',fd,'Cropping your image…',x=>{const ty=(x.response.type.split('/')[1])||'png';
    showResult(x.response,base(F)+'-cropped.'+(ty=='jpeg'?'jpg':ty))})};
`
};

// ---------- Shared layout (same header, footer and mobile nav as seotize.net) ----------

const NAV = `<header class="topnav" id="topnav">
  <div class="nav-inner">
    <a href="/" class="logo" aria-label="Seotize home"><svg viewBox="0 0 32 32" aria-hidden="true"><path class="logo-bg" d="M16 0C28.5 0 32 3.5 32 16S28.5 32 16 32 0 28.5 0 16 3.5 0 16 0z"/><path class="logo-base" d="M7 25.5h18"/><path class="logo-line" d="M7 21.5l5.2-6 4 3.2L24 10"/><path class="logo-flow" d="M7 21.5l5.2-6 4 3.2L24 10"/><path class="logo-head" d="M18.6 10H24v5.4"/></svg><span>Seotize<i class="logo-dot"></i></span></a>
    <nav aria-label="Main"><ul class="nav-links">
      <li><a href="/" data-key="home">Home</a></li><li><a href="/#features" data-key="features">Features</a></li><li><a href="/#pricing" data-key="pricing">Pricing</a></li><li><a href="/tools" data-key="tools" class="active">Tools <span class="new-chip">FREE</span></a></li><li><a href="/blogs" data-key="blog">Blog</a></li>
    </ul></nav>
    <div class="nav-actions">
      <button class="icon-btn" onclick="toggleTheme()" aria-label="Toggle dark mode"><i id="themeIcon" class="ri-moon-line"></i></button>
      <a href="/connect.html" class="btn btn-primary nav-cta" aria-label="Get Started"><span>Get Started</span><i class="ri-arrow-right-line"></i></a>
    </div>
  </div>
</header>`;

const MNAV = `<nav class="mobile-nav" aria-label="Mobile">
  <div class="mobile-items"><span class="mobile-pill"></span>
    <a href="/" class="mobile-item" data-key="home"><i class="ri-home-5-line"></i><span>Home</span></a><a href="/tools" class="mobile-item active" data-key="tools"><i class="ri-tools-line"></i><span>Tools</span></a><a href="/#pricing" class="mobile-item" data-key="pricing"><i class="ri-price-tag-3-line"></i><span>Pricing</span></a><a href="/blogs" class="mobile-item" data-key="blog"><i class="ri-article-line"></i><span>Blog</span></a><a href="/connect.html" class="mobile-item" data-key="connect"><i class="ri-user-star-line"></i><span>Connect</span></a>
  </div>
</nav>
<button class="to-top" aria-label="Back to top"><i class="ri-arrow-up-line"></i></button>`;

const FOOTER = `<footer class="footer">
  <div class="container">
    <div class="footer-top">
      <div class="footer-brand">
        <a href="/" class="logo" aria-label="Seotize home"><svg viewBox="0 0 32 32" aria-hidden="true"><path class="logo-bg" d="M16 0C28.5 0 32 3.5 32 16S28.5 32 16 32 0 28.5 0 16 3.5 0 16 0z"/><path class="logo-base" d="M7 25.5h18"/><path class="logo-line" d="M7 21.5l5.2-6 4 3.2L24 10"/><path class="logo-flow" d="M7 21.5l5.2-6 4 3.2L24 10"/><path class="logo-head" d="M18.6 10H24v5.4"/></svg><span>Seotize<i class="logo-dot"></i></span></a>
        <p>Real people, real rankings. Human engagement, AI content and a global CDN &mdash; in one platform.</p>
      </div>
      <div><h2>Product</h2><ul>
        <li><a href="/#features">Features</a></li><li><a href="/#pricing">Pricing</a></li><li><a href="/tools">Free Tools</a></li><li><a href="/connect.html">Get Started</a></li>
      </ul></div>
      <div><h2>Company</h2><ul>
        <li><a href="/about-us.html">About Us</a></li><li><a href="/contact-us.html">Contact Us</a></li><li><a href="/partner/">Become a Partner</a></li>
      </ul></div>
      <div><h2>Resources</h2><ul>
        <li><a href="/blogs">Blog</a></li><li><a href="/terms-of-service.html">Terms of Service</a></li><li><a href="/terms-of-service.html#privacy">Privacy Policy</a></li>
      </ul></div>
    </div>
    <div class="footer-bottom">
      <p>&copy; 2026 SEOTIZE. All rights reserved.</p>
      <div class="social-links">
        <a href="mailto:support@seotize.net" aria-label="Email">
<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path fill="#2563EB" d="M12 12.713.015 3h23.97L12 12.713ZM6.575 10.89.001 5.562V18.06l6.574-7.17Zm10.85 0 6.575 7.17V5.561l-6.575 5.329Zm-1.557 1.262L12 15.29l-3.868-3.138L0 21h24l-8.11-8.847Z"/></svg>
</a>
<a href="https://t.me/seotize" aria-label="Telegram" target="_blank" rel="noopener">
<svg width="27" height="27" viewBox="0 0 24 24" aria-hidden="true"><path fill="#29B6F6" d="M19,24l-14,0c-2.761,0 -5,-2.239 -5,-5l0,-14c0,-2.761 2.239,-5 5,-5l14,0c2.762,0 5,2.239 5,5l0,14c0,2.761 -2.238,5 -5,5Zm-2.744,-5.148c0.215,0.153 0.491,0.191 0.738,0.097c0.246,-0.093 0.428,-0.304 0.483,-0.56c0.579,-2.722 1.985,-9.614 2.512,-12.09c0.039,-0.187 -0.027,-0.381 -0.173,-0.506c-0.147,-0.124 -0.351,-0.16 -0.532,-0.093c-2.795,1.034 -11.404,4.264 -14.923,5.567c-0.223,0.082 -0.368,0.297 -0.361,0.533c0.008,0.235 0.167,0.44 0.395,0.509c1.578,0.471 3.65,1.128 3.65,1.128c0,0 0.967,2.924 1.472,4.41c0.063,0.187 0.21,0.334 0.402,0.384c0.193,0.05 0.397,-0.002 0.541,-0.138c0.811,-0.765 2.064,-1.948 2.064,-1.948c0,0 2.381,1.746 3.732,2.707Zm-7.34,-5.784l1.119,3.692l0.249,-2.338c0,0 4.324,-3.9 6.79,-6.124c0.072,-0.065 0.082,-0.174 0.022,-0.251c-0.06,-0.077 -0.169,-0.095 -0.251,-0.043c-2.857,1.825 -7.929,5.064 -7.929,5.064Z"/></svg>
</a>
<a href="https://instagram.com/seotize" aria-label="Instagram" target="_blank" rel="noopener">
<svg width="23" height="23" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="igGradFooter" x1="0" y1="24" x2="24" y2="0"><stop offset="0" stop-color="#FEE411"/><stop offset=".3" stop-color="#FB5133"/><stop offset=".65" stop-color="#C6229D"/><stop offset="1" stop-color="#5E22B7"/></linearGradient></defs><path fill="url(#igGradFooter)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
</a>
<a href="https://x.com/seotize" aria-label="X (Twitter)" target="_blank" rel="noopener">
<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.3 10.9 19 4.5h-1.9l-4.9 5.6-4-5.6H3l6 8.6-6 6.9h1.9l5.2-6 4.3 6H21l-6.2-8.7Zm-1.8 2.1-.6-.8-4.8-6.8h2.1l3.9 5.5.6.8 5.1 7.2h-2.1l-4.2-5.9Z"/></svg>
</a>
<a href="https://signal.me/#u/seotize" aria-label="Signal" target="_blank" rel="noopener">
<svg width="23" height="23" viewBox="0 0 24 24" aria-hidden="true"><path fill="#3A76F0" d="M12 2a10 10 0 0 0-8.7 15.03L2 22l5.17-1.3A10 10 0 1 0 12 2Z"/></svg>
</a>
      </div>
    </div>
  </div>
</footer>`;

// Tool-specific styles. Everything else (tokens, nav, footer, cards, buttons) comes from /assets/site.css.
const CSS = String.raw`
.thero{padding-bottom:2.5rem}
.thero.is-tool{padding-top:calc(var(--nav-h) + 3rem);padding-bottom:2rem}
.thero.is-tool h1{font-size:clamp(2.1rem,4.6vw,3.2rem)}
.thero+.container>.tools-grid{margin-top:.5rem}
.crumb{display:flex;justify-content:center;align-items:center;gap:.25rem;font-size:.85rem;color:var(--text-light);margin-bottom:1.1rem}
.crumb a{color:var(--primary);text-decoration:none;font-weight:600}
.trust-row{display:flex;justify-content:center;flex-wrap:wrap;gap:.6rem;margin-top:1.6rem}
.trust-row span{display:inline-flex;align-items:center;gap:.4rem;padding:.45rem .9rem;border-radius:99px;background:var(--surface);border:1px solid var(--border);font-size:.85rem;font-weight:600;color:var(--text-2)}
.trust-row i{color:var(--primary)}
.tools-grid.two{grid-template-columns:repeat(2,1fr)}
.more{margin:4.5rem 0 1rem}
.tool{max-width:860px;margin:0 auto;padding:0;overflow:hidden;box-shadow:var(--shadow-lg)}
.tool-head{display:flex;align-items:center;gap:.85rem;padding:1rem 1.25rem;border-bottom:1px solid var(--border);background:var(--surface-2)}
.tool-head b{display:block;font-size:.98rem}.tool-head small{color:var(--text-light);font-size:.8rem}
.tool-head .chip{margin-left:auto}
.ticon{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;font-size:1.25rem;color:#fff;box-shadow:0 10px 20px -10px var(--glow-strong)}
.tool-body{padding:1.5rem}
.view{display:none}
.drop{position:relative;display:flex;flex-direction:column;align-items:center;gap:.35rem;border:2px dashed var(--border-strong);border-radius:20px;padding:3.5rem 1.25rem;text-align:center;cursor:pointer;transition:border-color .25s,background .25s,transform .35s var(--ease);background:radial-gradient(500px 200px at 50% 0%,var(--glow),transparent 70%),var(--bg)}
.drop:hover,.drop.on{border-color:var(--primary);background:radial-gradient(500px 220px at 50% 0%,var(--glow-strong),transparent 70%),var(--bg)}
.drop.on{transform:scale(1.01)}
.dicon{width:68px;height:68px;margin-bottom:.8rem;border-radius:20px;display:grid;place-items:center;font-size:2rem;color:#fff;background:linear-gradient(135deg,var(--primary),var(--primary-dark));box-shadow:0 16px 30px -12px var(--glow-strong);animation:bob 3s ease-in-out infinite}
@keyframes bob{50%{transform:translateY(-6px)}}
.drop b{font-family:var(--font-display);font-size:1.25rem;font-weight:700}
.drop small{color:var(--text-light)}
.drop u{color:var(--primary);text-decoration:none;font-weight:600}
.paste-hint{margin-top:.6rem;display:inline-flex;align-items:center;gap:.35rem;font-size:.76rem;color:var(--muted)}
.tsw{display:flex;justify-content:center;align-items:center;margin:1.1rem auto 0;width:100%;min-height:65px}
#ts{width:100%;max-width:400px;display:flex;justify-content:center}
#ts>div,#ts iframe{margin:0 auto!important}
.opts{display:flex;flex-wrap:wrap;gap:1rem;margin-bottom:1rem;align-items:flex-end}
.opts.center{justify-content:center;margin:1.2rem 0 0}
.opts label{flex:1 1 160px;min-width:0;max-width:280px;display:flex;flex-direction:column;gap:.45rem;font-size:.85rem;font-weight:600;color:var(--text-2);text-align:left}
.opts select{padding:.75rem .85rem;border-radius:12px;border:1px solid var(--border);background:var(--surface);color:var(--text);font:500 .92rem var(--font-body);outline:none}
.opts select:focus{border-color:var(--primary);box-shadow:0 0 0 4px var(--glow)}
.opts input[type=range]{accent-color:var(--primary);height:40px}
.opts b{color:var(--primary)}
.dim{font-family:var(--font-mono);font-size:.82rem;font-weight:600;color:var(--primary);background:var(--glow);padding:.75rem 1rem;border-radius:12px}
.row{display:flex;justify-content:space-between;font-size:.9rem;color:var(--text-light);margin-bottom:.6rem}.row b{color:var(--text)}
.row span{font-family:var(--font-mono)}
.bar{height:10px;border-radius:99px;background:var(--surface-3);overflow:hidden}
.fill{height:100%;width:0;border-radius:99px;transition:width .3s;position:relative;background:linear-gradient(90deg,var(--primary),var(--accent))}
.fill:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);animation:sh 1.2s infinite}
@keyframes sh{from{transform:translateX(-100%)}to{transform:translateX(100%)}}
.steps{display:flex;gap:.5rem;margin-top:1rem}
.st{flex:1;display:flex;align-items:center;justify-content:center;gap:.4rem;font-size:.76rem;font-weight:600;text-align:center;padding:.6rem .35rem;border-radius:12px;border:1px solid var(--border);color:var(--muted);transition:.3s}
.st i{width:8px;height:8px;border-radius:50%;background:currentColor;flex-shrink:0}
.st.act{border-color:var(--primary);color:var(--primary);background:var(--glow)}
.st.act i{animation:pulse 1s infinite}
@keyframes pulse{50%{opacity:.3}}
.st.ok{border-color:color-mix(in srgb,var(--success) 50%,var(--border));color:var(--success)}
.thumb{margin-top:1.25rem;border-radius:16px;overflow:hidden;position:relative;display:flex;justify-content:center;background:var(--bg);border:1px solid var(--border)}
.thumb img{max-height:300px;max-width:100%;filter:saturate(.6) brightness(.85)}
.scan{position:absolute;left:0;right:0;height:3px;background:var(--accent);box-shadow:0 0 24px var(--accent);animation:sc 1.6s ease-in-out infinite alternate}
@keyframes sc{from{top:0}to{top:calc(100% - 3px)}}
#res,#edit{text-align:center}
.res-badge{display:inline-flex;align-items:center;gap:.4rem;margin-bottom:1rem;padding:.35rem .85rem;border-radius:99px;font-size:.8rem;font-weight:700;color:var(--success);background:color-mix(in srgb,var(--success) 14%,transparent)}
.checker{background:repeating-conic-gradient(var(--surface-3) 0 25%,var(--surface) 0 50%) 0 0/20px 20px}
#r{display:block;margin:0 auto;max-width:100%;max-height:62vh;border-radius:16px;border:1px solid var(--border)}
.wide{width:100%;margin-top:1.1rem}
.again{margin-top:.6rem}
.errm{display:none;align-items:center;justify-content:center;gap:.5rem;margin-top:1rem;padding:.85rem 1rem;border-radius:14px;background:color-mix(in srgb,var(--danger) 9%,transparent);border:1px solid color-mix(in srgb,var(--danger) 35%,transparent);color:var(--danger);font-size:.9rem;font-weight:500;text-align:center}
.est{display:flex;justify-content:center;flex-wrap:wrap;gap:.75rem;margin-top:1rem}
.est span{flex:1 1 0;max-width:220px;display:flex;flex-direction:column;align-items:center;gap:.2rem;min-width:0;padding:.7rem 1rem;border-radius:14px;background:var(--bg);border:1px solid var(--border);font-size:.75rem;color:var(--text-light)}
.est b{font-size:1rem;color:var(--text)}
.good,.bad{display:block;font-style:normal;font-weight:800;font-size:.85rem;color:var(--success)}.bad{color:var(--danger)}
.prev{display:block;margin:0 auto;max-width:100%;max-height:45vh;border-radius:16px;border:1px solid var(--border)}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;margin-top:1.25rem}
.stats div{background:var(--bg);border:1px solid var(--border);border-radius:14px;padding:.8rem}
.stats small{display:block;color:var(--text-light);font-size:.75rem;margin-bottom:.25rem}.stats b{font-size:1rem;display:block}
.ratios{display:inline-flex;flex-wrap:wrap;gap:.3rem;justify-content:center;margin-bottom:1rem;padding:.3rem;border-radius:14px;background:var(--surface-2);border:1px solid var(--border)}
.ratios button{padding:.5rem 1rem;border-radius:10px;border:0;background:transparent;color:var(--text-light);font:600 .85rem var(--font-body);cursor:pointer;transition:.2s}
.ratios button.on{background:linear-gradient(135deg,var(--primary),var(--primary-dark));color:#fff;box-shadow:0 6px 14px -6px var(--glow-strong)}
.stage{position:relative;display:inline-block;max-width:100%;overflow:hidden;border-radius:14px;touch-action:none;user-select:none;-webkit-user-select:none;line-height:0}
.stage img{display:block;max-width:100%;max-height:60vh;pointer-events:none}
.cbox{position:absolute;border:2px solid #fff;box-shadow:0 0 0 9999px rgba(2,6,23,.6);cursor:move;touch-action:none;
background:linear-gradient(90deg,transparent calc(33.33% - 1px),rgba(255,255,255,.45) 0 calc(33.33% + 1px),transparent 0 calc(66.66% - 1px),rgba(255,255,255,.45) 0 calc(66.66% + 1px),transparent 0),linear-gradient(transparent calc(33.33% - 1px),rgba(255,255,255,.45) 0 calc(33.33% + 1px),transparent 0 calc(66.66% - 1px),rgba(255,255,255,.45) 0 calc(66.66% + 1px),transparent 0)}
.cbox i{position:absolute;width:20px;height:20px;background:#fff;border:3px solid var(--primary);border-radius:50%}
.cbox [data-h=nw]{left:-3px;top:-3px;cursor:nwse-resize}.cbox [data-h=ne]{right:-3px;top:-3px;cursor:nesw-resize}
.cbox [data-h=sw]{left:-3px;bottom:-3px;cursor:nesw-resize}.cbox [data-h=se]{right:-3px;bottom:-3px;cursor:nwse-resize}
.perks{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;max-width:860px;margin:1.5rem auto 0}
.perks div{display:grid;grid-template-columns:auto 1fr;column-gap:.7rem;align-items:center;padding:1rem 1.1rem;border-radius:16px;background:var(--surface);border:1px solid var(--border)}
.perks i{grid-row:span 2;width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:var(--glow);color:var(--primary);font-size:1.1rem}
.perks b{font-size:.92rem}.perks span{font-size:.8rem;color:var(--text-light)}
@media(max-width:768px){.thero.is-tool p{font-size:1rem}.thero.is-tool{padding-bottom:1.5rem}.tools-grid.two{grid-template-columns:1fr}.perks{grid-template-columns:1fr}.thero.is-tool{padding-top:calc(var(--nav-h) + 1.75rem)}}
@media(max-width:480px){.tool-body{padding:.9rem}.tool-head{padding:.85rem 1rem}.drop{padding:2.5rem 1rem}.stats{gap:.5rem}.stats div{padding:.6rem .4rem}.stats b{font-size:.9rem}.st{font-size:.66rem;flex-direction:column;gap:.25rem}}
`;
