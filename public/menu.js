// OctoOrgler burger menu. Include with <script src="/menu.js" defer></script> on any page.
(function () {
  const ITEMS = [
    { href: '/index.html', label: 'Play', match: ['/', '/index.html'] },
    { href: '/lamp.html', label: 'Lamp view', match: ['/lamp.html'] },
    { href: '/control/', label: 'Lamp control', match: ['/control', '/control/', '/control/index.html'] },
    { href: '/admin/', label: 'Admin settings', match: ['/admin', '/admin/', '/admin/index.html'] },
  ];

  const css = `
  .oo-menu-btn{position:fixed;top:10px;right:10px;z-index:1001;width:44px;height:44px;border:1px solid #333;border-radius:8px;background:rgba(17,17,17,.9);cursor:pointer;display:grid;place-content:center;gap:5px;padding:0}
  .oo-menu-btn span{display:block;width:22px;height:2px;background:#00ff41;border-radius:1px;transition:transform .2s,opacity .2s}
  .oo-menu-btn[aria-expanded="true"] span:nth-child(1){transform:translateY(7px) rotate(45deg)}
  .oo-menu-btn[aria-expanded="true"] span:nth-child(2){opacity:0}
  .oo-menu-btn[aria-expanded="true"] span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}
  .oo-menu-backdrop{position:fixed;inset:0;z-index:999;background:rgba(0,0,0,.5)}
  .oo-menu{position:fixed;top:0;right:0;z-index:1000;height:100%;width:min(78vw,260px);background:#111;border-left:1px solid #333;padding:66px 0 16px;box-sizing:border-box;transform:translateX(100%);transition:transform .2s;font-family:sans-serif}
  .oo-menu.open{transform:none}
  .oo-menu a{display:block;padding:14px 22px;color:#eee;text-decoration:none;font-size:1.05em;border-left:3px solid transparent}
  .oo-menu a:hover,.oo-menu a:focus-visible{background:#1d1d1d;outline:none}
  .oo-menu a[aria-current="page"]{color:#00ff41;border-left-color:#00ff41;background:#151515}
  .oo-menu-title{padding:0 22px 10px;font-family:'Courier New',monospace;color:#00ff41;letter-spacing:2px}`;

  function init() {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'oo-menu-btn';
    btn.setAttribute('aria-label', 'Menu');
    btn.setAttribute('aria-controls', 'ooMenu');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span></span><span></span><span></span>';

    const nav = document.createElement('nav');
    nav.id = 'ooMenu';
    nav.className = 'oo-menu';
    nav.setAttribute('aria-label', 'OctoOrgler');
    nav.hidden = true;
    const title = document.createElement('div');
    title.className = 'oo-menu-title';
    title.textContent = 'OCTOORGLER';
    nav.appendChild(title);
    const here = location.pathname;
    ITEMS.forEach(item => {
      const a = document.createElement('a');
      a.href = item.href;
      a.textContent = item.label;
      if (item.match.includes(here)) a.setAttribute('aria-current', 'page');
      nav.appendChild(a);
    });

    const backdrop = document.createElement('div');
    backdrop.className = 'oo-menu-backdrop';
    backdrop.hidden = true;

    function setOpen(open) {
      btn.setAttribute('aria-expanded', String(open));
      backdrop.hidden = !open;
      if (open) {
        nav.hidden = false;
        requestAnimationFrame(() => nav.classList.add('open'));
        const first = nav.querySelector('a');
        if (first) first.focus();
      } else {
        nav.classList.remove('open');
        setTimeout(() => { if (btn.getAttribute('aria-expanded') === 'false') nav.hidden = true; }, 200);
      }
    }

    btn.addEventListener('click', () => setOpen(btn.getAttribute('aria-expanded') !== 'true'));
    backdrop.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { setOpen(false); btn.focus(); }
    });

    document.body.append(backdrop, nav, btn);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
