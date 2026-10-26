#!/usr/bin/env python3
"""Shared header / footer / mobile-nav for the static SEOTIZE pages.

Pages contain one-line markers which this script expands in place:
    <!--@HEAD-->            fonts, icons, favicons, site.css
    <!--@NAV:key-->         top navigation, `key` marks the active link
    <!--@MNAV:key-->        mobile bottom navigation
    <!--@FOOTER-->          footer
    <!--@SCRIPTS-->         gsap + ScrollTrigger + site.js

Already-expanded blocks are wrapped in <!--@X:key:start--> ... <!--@X:end-->
comments, so re-running the script refreshes them:

    python3 assets/partials.py index.html blogs.html ...
"""
import re
import sys

HEAD = """<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://cdnjs.cloudflare.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@500;600;700;800;900&family=JetBrains+Mono:wght@500;600&display=swap">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/remixicon@4.0.0/fonts/remixicon.css">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#0b1222">
<link rel="stylesheet" href="/assets/site.css">"""

THEME_BOOT = """<script>try{localStorage.getItem('theme')==='dark'&&document.body.classList.add('dark')}catch(e){}</script>"""

LINKS = [
    ("home", "/", "Home"),
    ("features", "/#features", "Features"),
    ("pricing", "/#pricing", "Pricing"),
    ("tools", "/tools", "Tools"),
    ("blog", "/blogs.html", "Blog"),
    ("partner", "/partner/", "Partners"),
]

def nav(key):
    items = []
    for k, href, label in LINKS:
        chip = ' <span class="new-chip">FREE</span>' if k == "tools" else ""
        cls = ' class="active"' if k == key else ""
        items.append(f'<li><a href="{href}" data-key="{k}"{cls}>{label}{chip}</a></li>')
    cta_href, cta_label = ("/partner/login.html", "Partner Login") if key == "partner" else ("/connect.html", "Get Started")
    return f"""{THEME_BOOT}
<header class="topnav" id="topnav">
  <div class="nav-inner">
    <a href="/" class="logo" onmouseenter="animLogo()" aria-label="SEOTIZE home">
      <span class="logo-icon"><span class="logo-bar logo-b1"></span><span class="logo-bar logo-b2"></span><span class="logo-bar logo-b3"></span></span>
      SEOTIZE
    </a>
    <nav aria-label="Main"><ul class="nav-links">
      {"".join(items)}
    </ul></nav>
    <div class="nav-actions">
      <button class="icon-btn" onclick="toggleTheme()" aria-label="Toggle dark mode"><i id="themeIcon" class="ri-moon-line"></i></button>
      <a href="{cta_href}" class="btn btn-primary nav-cta"><span>{cta_label}</span><i class="ri-arrow-right-line"></i></a>
    </div>
  </div>
</header>"""

MOBILE = [
    ("home", "/", "ri-home-5-line", "Home"),
    ("features", "/#features", "ri-flashlight-line", "Features"),
    ("tools", "/tools", "ri-tools-line", "Tools"),
    ("pricing", "/#pricing", "ri-price-tag-3-line", "Pricing"),
    ("blog", "/blogs.html", "ri-article-line", "Blog"),
    ("connect", "/connect.html", "ri-user-star-line", "Connect"),
]

def mnav(key):
    items = []
    for k, href, icon, label in MOBILE:
        cls = " active" if k == key else ""
        items.append(f'<a href="{href}" class="mobile-item{cls}" data-key="{k}"><i class="{icon}"></i><span>{label}</span></a>')
    return f"""<nav class="mobile-nav" aria-label="Mobile">
  <div class="mobile-items"><span class="mobile-pill"></span>
    {"".join(items)}
  </div>
</nav>
<button class="to-top" aria-label="Back to top"><i class="ri-arrow-up-line"></i></button>"""

SOCIAL = open(__file__.replace("partials.py", "social.html")).read().strip()

FOOTER = f"""<footer class="footer">
  <div class="container">
    <div class="footer-top">
      <div class="footer-brand">
        <a href="/" class="logo"><span class="logo-icon"><span class="logo-bar logo-b1"></span><span class="logo-bar logo-b2"></span><span class="logo-bar logo-b3"></span></span>SEOTIZE</a>
        <p>Real people, real rankings. Human engagement, AI content and a global CDN &mdash; in one platform.</p>
      </div>
      <div><h4>Product</h4><ul>
        <li><a href="/#features">Features</a></li><li><a href="/#pricing">Pricing</a></li><li><a href="/tools">Free Tools</a></li><li><a href="/connect.html">Get Started</a></li>
      </ul></div>
      <div><h4>Company</h4><ul>
        <li><a href="/about-us.html">About Us</a></li><li><a href="/contact-us.html">Contact Us</a></li><li><a href="/partner/">Become a Partner</a></li>
      </ul></div>
      <div><h4>Resources</h4><ul>
        <li><a href="/blogs.html">Blog</a></li><li><a href="/terms-of-service.html">Terms of Service</a></li><li><a href="/terms-of-service.html#privacy">Privacy Policy</a></li>
      </ul></div>
    </div>
    <div class="footer-bottom">
      <p>&copy; 2026 SEOTIZE. All rights reserved.</p>
      <div class="social-links">
        {SOCIAL}
      </div>
    </div>
    <div class="footer-wordmark" aria-hidden="true">SEOTIZE</div>
  </div>
</footer>"""

SCRIPTS = """<script defer src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
<script defer src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js"></script>
<script defer src="/assets/site.js"></script>"""

def block(name, key, html):
    tag = f"{name}:{key}" if key else name
    return f"<!--@{tag}:start-->\n{html}\n<!--@{name}:end-->"

def render(name, key):
    if name == "HEAD": return HEAD
    if name == "NAV": return nav(key)
    if name == "MNAV": return mnav(key)
    if name == "FOOTER": return FOOTER
    if name == "SCRIPTS": return SCRIPTS
    raise ValueError(name)

PAT = re.compile(r"<!--@(HEAD|NAV|MNAV|FOOTER|SCRIPTS)(?::(?!start\b)(\w+))?(?::start-->.*?<!--@\1:end-->|-->)", re.S)

def expand(text):
    return PAT.sub(lambda m: block(m.group(1), m.group(2), render(m.group(1), m.group(2))), text)

if __name__ == "__main__":
    for path in sys.argv[1:]:
        src = open(path, encoding="utf-8").read()
        out = expand(src)
        if out != src:
            open(path, "w", encoding="utf-8").write(out)
            print("updated", path)
