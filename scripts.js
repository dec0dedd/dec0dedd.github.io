// ---------- Dark mode toggle, remember in localStorage ----------
(function(){
  const root = document.documentElement;
  const storageKey = 'site-theme'; // 'dark' | 'light' | 'system'

  // determine initial theme: localStorage > system preference
  function getPreferredTheme(){
    const stored = localStorage.getItem(storageKey);
    if(stored === 'dark' || stored === 'light') return stored;
    // default to system
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme){
    if(theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }

  // build toggle button
  function buildToggle(){
    const btn = document.createElement('button');
    btn.className = 'theme-toggle';
    btn.setAttribute('aria-label','Toggle dark mode');
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"></path>
      </svg>
    `;
    btn.addEventListener('click', ()=>{
      const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      localStorage.setItem(storageKey, next);
      applyTheme(next);
    });
    return btn;
  }

  // init
  applyTheme(getPreferredTheme());
  // also update if system preference changes and user hasn't chosen explicit theme
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if(!localStorage.getItem(storageKey)) applyTheme(e.matches ? 'dark' : 'light');
  });

  // Insert toggle button into navbar if present, else into body
  function mountToggle(btn){
    // try to find Quarto-ish navbar container:
    const candidates = [
      document.querySelector('nav.navbar'),
      document.querySelector('.q-navbar'),
      document.querySelector('header'),
      document.querySelector('.site-header'),
    ];
    let placed = false;
    for(const el of candidates){
      if(!el) continue;
      // try to append right side
      el.appendChild(btn);
      placed = true;
      break;
    }
    if(!placed){
      document.body.appendChild(btn);
    }
  }

  const toggle = buildToggle();
  mountToggle(toggle);
})();

// ---------- Left reading rail with section markers ----------
(function(){
  // config: which headings to include
  const selectors = ['h2', 'h3'];  // change if you want h1/h4 etc.
  const navHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 62;

  function makeRail(){
    const rail = document.createElement('div');
    rail.className = 'lw-left-rail';
    rail.innerHTML = `
      <div class="rail-bg"></div>
      <div class="rail-progress" style="height:0%"></div>
      <div class="rail-markers"></div>
    `;
    document.body.appendChild(rail);
    return rail;
  }

  function getHeadings(){
    const headings = [];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(h => {
        // ignore headings inside navigation, toc, etc.
        if(h.closest('.nav') || h.closest('.toc')) return;
        headings.push(h);
      });
    });
    return headings;
  }

  const rail = makeRail();
  const progressEl = rail.querySelector('.rail-progress');
  const markersEl = rail.querySelector('.rail-markers');

  let headings = [];
  let markerEls = [];

  function rebuildMarkers(){
    headings = getHeadings();
    markersEl.innerHTML = '';
    markerEls = [];

    const docHeight = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);

    headings.forEach((h, i) => {
      const top = h.getBoundingClientRect().top + window.pageYOffset;
      const pct = (top - navHeight) / docHeight;
      const pos = Math.min(Math.max(pct * 100, 0), 100);

      const m = document.createElement('button');
      m.className = 'rail-marker';
      m.style.top = pos + '%';
      m.title = h.innerText.trim().slice(0, 80);
      m.setAttribute('aria-label', 'Jump to: ' + (h.innerText || 'section'));
      m.addEventListener('click', (ev)=>{
        ev.preventDefault();
        // smooth scroll to heading (account for nav height)
        const targetY = h.getBoundingClientRect().top + window.pageYOffset - navHeight - 16;
        window.scrollTo({ top: targetY, behavior: 'smooth' });
      });

      markersEl.appendChild(m);
      markerEls.push({el: m, heading: h});
    });

    // give a bit of delay for layout to settle in some themes
    updateOnScroll();
  }

  function updateOnScroll(){
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) : 0;
    const pctCss = (pct * 100) + '%';
    progressEl.style.height = pctCss;

    // find active heading — closest heading whose top <= scrollTop + navHeight + 6
    let activeIndex = -1;
    for(let i=0;i<headings.length;i++){
      const hTop = headings[i].getBoundingClientRect().top + window.pageYOffset - navHeight - 8;
      if(hTop <= scrollTop) activeIndex = i;
      else break;
    }
    // if none matched, the first one is upcoming; choose the first
    if(activeIndex === -1 && headings.length > 0) activeIndex = 0;

    // highlight active marker
    markerEls.forEach((m,i)=>{
      if(i === activeIndex) m.el.classList.add('active'); else m.el.classList.remove('active');
    });
  }

  // rebuild on load, resize, and mutation (in case content changes)
  window.addEventListener('load', ()=> {
    setTimeout(rebuildMarkers, 80);
  });
  window.addEventListener('resize', ()=> {
    setTimeout(rebuildMarkers, 120);
  });
  window.addEventListener('scroll', ()=> {
    // throttle a little using rAF style
    if(window.__lw_rail_anim) return;
    window.__lw_rail_anim = requestAnimationFrame(()=>{
      updateOnScroll();
      window.__lw_rail_anim = null;
    });
  });

  // watch for dynamic content changes (Quarto rendering, math, etc.)
  const observer = new MutationObserver(()=> {
    // debounce
    if(window.__lw_rail_rebuild) clearTimeout(window.__lw_rail_rebuild);
    window.__lw_rail_rebuild = setTimeout(()=>{
      rebuildMarkers();
    }, 200);
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });

})();
