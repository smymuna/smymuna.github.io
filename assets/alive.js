/* alive.js — makes the portfolio respond like a pet: it notices you, leans in, reacts
   to touch, and dozes off when left alone. Built on GSAP (springs, Flip) with plain DOM.

   Respects prefers-reduced-motion (calm mode) and coarse pointers (no hover effects).
   Every element added here is decorative (aria-hidden), except Byte, which is a button. */
(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const G = window.gsap;
  if (G && window.Flip) G.registerPlugin(window.Flip);

  const root = document.documentElement;
  const store = {
    get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };
  const cssVar = (el, name) => getComputedStyle(el).getPropertyValue(name).trim();
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // One pointer position, one animation frame for everything that follows it.
  const mouse = { x: innerWidth / 2, y: innerHeight / 2, active: false };
  const frameJobs = [];
  let framePending = false;
  const requestFrame = () => {
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(() => { framePending = false; frameJobs.forEach((job) => job()); });
  };
  addEventListener('pointermove', (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true;
    requestFrame();
  }, { passive: true });

  /* 1. Scroll progress ------------------------------------------------------------- */
  const bar = Object.assign(document.createElement('div'), { className: 'alive-progress' });
  bar.setAttribute('aria-hidden', 'true');
  document.body.append(bar);
  const onScroll = () => {
    const max = root.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* 2. Cursor ring (fine pointers only; the system cursor stays) -------------------- */
  if (fine && !reduce) {
    const ring = Object.assign(document.createElement('div'), { className: 'alive-cursor' });
    ring.setAttribute('aria-hidden', 'true');
    document.body.append(ring);
    const pos = { x: mouse.x, y: mouse.y };
    const follow = () => {
      pos.x += (mouse.x - pos.x) * 0.22;
      pos.y += (mouse.y - pos.y) * 0.22;
      ring.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
      if (Math.abs(mouse.x - pos.x) + Math.abs(mouse.y - pos.y) > 0.5) requestFrame();
    };
    frameJobs.push(follow);
    addEventListener('pointerover', (e) => {
      ring.classList.add('on');
      ring.classList.toggle('big', !!e.target.closest('a, button, .card, summary, select, input'));
    });
    addEventListener('pointerdown', () => ring.classList.add('press'));
    addEventListener('pointerup', () => ring.classList.remove('press'));
    document.addEventListener('pointerleave', () => ring.classList.remove('on'));
  }

  /* 3. Heading letters lean in toward the cursor (variable font weight) -------------- */
  const h1 = document.querySelector('.hero h1');
  const letters = [];
  if (h1) {
    // innerText turns <br> into a line break; textContent would glue "that" + "turns".
    h1.setAttribute('aria-label', h1.innerText.replace(/\s+/g, ' ').trim());
    const split = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(document.createTextNode(' ')); return; }
            const word = document.createElement('span');
            word.style.whiteSpace = 'nowrap'; // letters are spans; words still wrap normally
            [...part].forEach((c) => {
              const s = Object.assign(document.createElement('span'), { className: 'ch', textContent: c });
              s.setAttribute('aria-hidden', 'true');
              word.append(s);
              letters.push(s);
            });
            frag.append(word);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
          split(child);
        }
      });
    };
    split(h1);
    if (fine && !reduce) {
      frameJobs.push(() => {
        const box = h1.getBoundingClientRect();
        const near = mouse.y > box.top - 160 && mouse.y < box.bottom + 160;
        letters.forEach((l) => {
          let w = 600;
          if (near) {
            const r = l.getBoundingClientRect();
            const d = Math.hypot(mouse.x - (r.left + r.width / 2), mouse.y - (r.top + r.height / 2));
            w = 600 + 200 * Math.max(0, 1 - d / 170); // up to 800 right under the cursor
          }
          l.style.setProperty('--w', w.toFixed(0));
        });
      });
    }
  }

  /* 4. Magnetic buttons and links ------------------------------------------------- */
  if (G && fine && !reduce) {
    document.querySelectorAll('.btn, .filter, #theme, nav ul a, .links a').forEach((el) => {
      if (getComputedStyle(el).display === 'inline') el.style.display = 'inline-block';
      const strength = el.matches('.btn, #theme') ? 0.32 : 0.2;
      const toX = G.quickTo(el, 'x', { duration: 0.4, ease: 'power3' });
      const toY = G.quickTo(el, 'y', { duration: 0.4, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        toX((e.clientX - (r.left + r.width / 2)) * strength);
        toY((e.clientY - (r.top + r.height / 2)) * strength);
      });
      el.addEventListener('pointerleave', () => {
        G.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)' });
      });
    });
  }

  /* 5. Project cards tilt toward the pointer and squish when pressed ----------------- */
  const cards = [...document.querySelectorAll('.projects .card')];
  if (G && fine && !reduce) {
    cards.forEach((card) => {
      const max = card.classList.contains('featured') ? 2.5 : 5;
      const rx = G.quickTo(card, 'rotationX', { duration: 0.5, ease: 'power3' });
      const ry = G.quickTo(card, 'rotationY', { duration: 0.5, ease: 'power3' });
      const ty = G.quickTo(card, 'y', { duration: 0.5, ease: 'power3' });
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        ry(px * 2 * max); rx(-py * 2 * max); ty(-4);
      });
      card.addEventListener('pointerleave', () => {
        G.to(card, { rotationX: 0, rotationY: 0, y: 0, duration: 1.1, ease: 'elastic.out(1, 0.4)' });
      });
    });
  }
  if (G && !reduce) {
    document.querySelectorAll('.projects .card, .btn, .filter').forEach((el) => {
      el.addEventListener('pointerdown', () => G.to(el, { scale: 0.975, duration: 0.12, ease: 'power2.out' }));
      const release = () => G.to(el, { scale: 1, duration: 0.7, ease: 'elastic.out(1, 0.4)' });
      el.addEventListener('pointerup', release);
      el.addEventListener('pointerleave', release);
    });
  }

  /* 6. Sparks on click, in the colour of whatever was clicked ----------------------- */
  if (!reduce) {
    addEventListener('pointerdown', (e) => {
      const target = e.target.closest('a, button, .card, summary');
      if (!target || e.target.closest('.pup')) return;
      const colour = cssVar(target, '--accent') || cssVar(root, '--accent');
      if (document.hidden) return;
      for (let i = 0; i < 9; i++) {
        const s = Object.assign(document.createElement('span'), { className: 'alive-spark' });
        s.setAttribute('aria-hidden', 'true');
        s.style.cssText = `left:${e.clientX}px;top:${e.clientY}px;--spark:${colour}`;
        document.body.append(s);
        const a = (Math.PI * 2 * i) / 9 + Math.random() * 0.5;
        const d = 22 + Math.random() * 18;
        s.animate(
          [{ transform: 'translate(0,0) scale(1)', opacity: 1 },
           { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) scale(0)`, opacity: 0 }],
          { duration: 560, easing: 'cubic-bezier(.22,1,.36,1)' },
        ).onfinish = () => s.remove();
      }
    });
  }

  /* 7. Hero tech chips shy away from the cursor (springy, like a playful pup) -------- */
  const chips = [...document.querySelectorAll('.hero .orbit')];
  if (chips.length && fine && !reduce) {
    const state = chips.map(() => ({ x: 0, y: 0, vx: 0, vy: 0 }));
    let settling = false;
    const step = () => {
      let moving = false;
      chips.forEach((chip, i) => {
        const s = state[i];
        const r = chip.getBoundingClientRect();
        const cx = r.left + r.width / 2 - s.x;
        const cy = r.top + r.height / 2 - s.y;
        const dx = cx - mouse.x;
        const dy = cy - mouse.y;
        const d = Math.hypot(dx, dy) || 1;
        const push = d < 130 ? (130 - d) * 0.45 : 0; // target offset away from the cursor
        const tx = (dx / d) * push;
        const ty = (dy / d) * push;
        // spring towards the target: overshoot and settle, like something alive
        s.vx = (s.vx + (tx - s.x) * 0.12) * 0.78;
        s.vy = (s.vy + (ty - s.y) * 0.12) * 0.78;
        s.x += s.vx; s.y += s.vy;
        chip.style.translate = `${s.x.toFixed(1)}px ${s.y.toFixed(1)}px`;
        if (Math.abs(s.vx) + Math.abs(s.vy) > 0.05 || Math.abs(tx - s.x) > 0.3) moving = true;
      });
      settling = moving;
      if (moving) requestAnimationFrame(step);
    };
    frameJobs.push(() => { if (!settling) { settling = true; requestAnimationFrame(step); } });
  }

  /* 8. Filtering: cards glide to their new places (FLIP) ---------------------------- */
  if (G && window.Flip && !reduce) {
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.filter')) return;
      const state = window.Flip.getState('.projects .card');
      requestAnimationFrame(() => {
        window.Flip.from(state, {
          duration: 0.6, ease: 'power3.inOut', scale: true, nested: true,
          onEnter: (els) => G.fromTo(els, { opacity: 0, scale: 0.94 },
            { opacity: 1, scale: 1, duration: 0.5, stagger: 0.06, ease: 'back.out(1.6)' }),
        });
      });
    }, true); // capture: read positions before the page's own handler hides cards
  }

  /* 9. Theme switch spreads out from the button (View Transitions) ------------------ */
  addEventListener('click', (e) => {
    const btn = e.target.closest('#theme');
    if (!btn || !document.startViewTransition || reduce) return;
    e.stopPropagation(); // we perform the same toggle as the page, inside a transition
    const r = btn.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const toggle = () => {
      const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      root.dataset.theme = dark ? 'light' : 'dark';
      store.set('theme', root.dataset.theme);
    };
    const t = document.startViewTransition(toggle);
    t.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
        { duration: 650, easing: 'cubic-bezier(.22,1,.36,1)', pseudoElement: '::view-transition-new(root)' },
      );
    });
    pup?.say(root.dataset.theme === 'dark' ? 'Good morning! ☀️' : 'Lights out… 🌙');
  }, true);

  /* 10. Cards and timeline items rise in with a little stagger ----------------------- */
  if (G && !reduce && 'IntersectionObserver' in window) {
    const risers = [...document.querySelectorAll('.projects .card, .signal-bar article, .timeline > *')];
    G.set(risers, { opacity: 0, y: 26 });
    const seen = new IntersectionObserver((entries) => {
      const shown = entries.filter((en) => en.isIntersecting).map((en) => en.target);
      shown.forEach((el) => seen.unobserve(el));
      if (shown.length) G.to(shown, { opacity: 1, y: 0, duration: 0.8, stagger: 0.08, ease: 'power3.out' });
    }, { threshold: 0.12 });
    risers.forEach((el) => seen.observe(el));
  }

  /* 11. Byte, the site's pup ------------------------------------------------------- */
  const pup = (() => {
    if (store.get('pup', 'on') === 'off') { addReturnLink(); return null; }

    const el = document.createElement('button');
    el.className = 'pup';
    el.type = 'button';
    el.dataset.mood = 'idle';
    el.setAttribute('aria-label', "Pet Byte, the site's dog");
    el.innerHTML = `
      <svg viewBox="0 0 96 96" aria-hidden="true">
        <g class="head">
          <path class="ear l" d="M24 40 C10 44 8 66 18 72 C24 76 28 64 30 52 Z" fill="currentColor"/>
          <path class="ear r" d="M72 40 C86 44 88 66 78 72 C72 76 68 64 66 52 Z" fill="currentColor"/>
          <ellipse cx="48" cy="58" rx="27" ry="25" fill="var(--highlight)" stroke="currentColor" stroke-width="2.2"/>
          <g class="open">
            <g class="eye l"><g class="blink"><circle cx="38" cy="54" r="4.4" fill="var(--text)"/><circle cx="39.4" cy="52.6" r="1.3" fill="#fff"/></g></g>
            <g class="eye r"><g class="blink"><circle cx="58" cy="54" r="4.4" fill="var(--text)"/><circle cx="59.4" cy="52.6" r="1.3" fill="#fff"/></g></g>
          </g>
          <g class="happy" fill="none" stroke="var(--text)" stroke-width="2.4" stroke-linecap="round">
            <path d="M33 55 Q38 49 43 55"/><path d="M53 55 Q58 49 63 55"/>
          </g>
          <g class="closed" fill="none" stroke="var(--text)" stroke-width="2.2" stroke-linecap="round">
            <path d="M33 55 Q38 58 43 55"/><path d="M53 55 Q58 58 63 55"/>
          </g>
          <ellipse class="blush" cx="30" cy="64" rx="4.5" ry="2.6" fill="#ff8fb1" opacity=".6"/>
          <ellipse class="blush" cx="66" cy="64" rx="4.5" ry="2.6" fill="#ff8fb1" opacity=".6"/>
          <ellipse cx="48" cy="63" rx="4.2" ry="3.1" fill="var(--text)"/>
          <path d="M43 67 Q48 72 53 67" fill="none" stroke="var(--text)" stroke-width="2" stroke-linecap="round"/>
          <path class="tongue" d="M45.5 69 Q48 77 50.5 69 Z" fill="#ff6f96"/>
        </g>
      </svg>`;
    const hide = Object.assign(document.createElement('button'), { className: 'pup-hide', type: 'button', textContent: '×' });
    hide.setAttribute('aria-label', 'Hide Byte');
    const bubble = Object.assign(document.createElement('div'), { className: 'pup-bubble' });
    bubble.setAttribute('aria-hidden', 'true');
    document.body.append(el, hide, bubble);

    const head = el.querySelector('.head');
    const eyes = [...el.querySelectorAll('.eye')];
    const ears = [...el.querySelectorAll('.ear')];
    const lids = [...el.querySelectorAll('.blink')];
    // GSAP positions SVG transforms itself (CSS transform-origin is ignored on SVG):
    // eyes follow the pointer via their outer group, and blink via the inner one.
    if (G) {
      G.set(ears[0], { transformOrigin: '85% 10%' });
      G.set(ears[1], { transformOrigin: '15% 10%' });
      G.set(lids, { transformOrigin: '50% 50%' });
    }
    let energy = 0;            // how much it has been petted lately
    let lastActive = performance.now();
    let wag = null;
    let bubbleTimer = 0;
    let lastBubble = 0;

    const say = (text, ms = 2600) => {
      bubble.textContent = text;
      bubble.classList.add('show');
      lastBubble = performance.now();
      clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(() => bubble.classList.remove('show'), ms);
    };
    const float = (glyph, dx = 0) => {
      // Hidden tabs pause animations, so effects would pile up unseen; skip them.
      if (reduce || document.hidden) return;
      const r = el.getBoundingClientRect();
      const f = Object.assign(document.createElement('span'), { className: 'pup-float', textContent: glyph });
      f.setAttribute('aria-hidden', 'true');
      f.style.left = `${r.left + r.width / 2 - 8 + dx}px`;
      f.style.top = `${r.top + 8}px`;
      document.body.append(f);
      f.animate(
        [{ transform: 'translate(0,0) scale(.6)', opacity: 0 }, { transform: 'translate(0,-14px) scale(1)', opacity: 1, offset: 0.25 },
         { transform: `translate(${(Math.random() - 0.5) * 30}px,-60px) scale(.9)`, opacity: 0 }],
        { duration: 1400, easing: 'cubic-bezier(.22,1,.36,1)' },
      ).onfinish = () => f.remove();
    };

    const setMood = (mood) => {
      if (el.dataset.mood === mood) return;
      el.dataset.mood = mood;
      if (!G || reduce) return;
      if (mood === 'happy') {
        wag = G.timeline({ repeat: -1, yoyo: true })
          .to(ears[0], { rotation: -18, duration: 0.14, ease: 'sine.inOut' }, 0)
          .to(ears[1], { rotation: 18, duration: 0.14, ease: 'sine.inOut' }, 0);
        G.to(el, { y: -14, duration: 0.5, ease: 'back.out(2)' });
        const pets = Number(store.get('pets', '0')) + 1;
        store.set('pets', String(pets));
        if (pets === 1) say('Ohh, that’s the spot. 🐾');
        else if (pets % 10 === 0) say(`${pets} pets. Best day ever!`);
      } else {
        wag?.kill(); wag = null;
        G.to(ears, { rotation: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
        if (mood !== 'sleep') G.to(el, { y: 0, duration: 0.6, ease: 'power3.out' });
      }
    };

    const pet = (amount) => {
      energy = Math.min(4, energy + amount);
      lastActive = performance.now();
      if (energy > 1) setMood('happy');
    };
    const hop = () => {
      if (!G || reduce) return;
      G.timeline().to(el, { y: '-=18', duration: 0.18, ease: 'power2.out' })
        .to(el, { y: '+=18', duration: 0.5, ease: 'bounce.out' });
    };

    // Petting: stroke it with the pointer, or tap / press Enter or Space.
    let lx = null, ly = null;
    el.addEventListener('pointermove', (e) => {
      if (lx !== null) pet(Math.hypot(e.clientX - lx, e.clientY - ly) * 0.012);
      lx = e.clientX; ly = e.clientY;
    });
    el.addEventListener('pointerleave', () => { lx = ly = null; });
    el.addEventListener('click', () => { pet(1.6); hop(); float('♥'); float('♥', 14); });

    hide.addEventListener('click', () => {
      store.set('pup', 'off');
      say('Okay, I’ll nap in the footer. 💤', 1400);
      setTimeout(() => { el.remove(); hide.remove(); bubble.remove(); addReturnLink(); }, 1200);
    });

    // Looks at the project you hover, with a comment the first time.
    const lines = {
      'climate': 'That’s 32 countries of emissions data. 🌍',
      'gridshift': 'Psst: this one finds the cleanest hour. ⚡',
      'orbit': 'Satellites! This is my favourite. 🛰️',
      'agentic': 'Six AI agents in one pipeline. 🤖',
      'pet': 'Adopt-a-pup? Sorry, I’m taken. 🐶',
    };
    const commented = new Set();
    cards.forEach((card) => card.addEventListener('pointerenter', () => {
      const key = Object.keys(lines).find((k) => card.classList.contains(`theme-${k}`));
      if (!key || commented.has(key) || performance.now() - lastBubble < 5000) return;
      commented.add(key);
      say(lines[key]);
    }));

    // Easter egg: type "treat".
    let typed = '';
    addEventListener('keydown', (e) => {
      if (e.target.closest?.('input, textarea')) return;
      typed = (typed + e.key.toLowerCase()).slice(-5);
      lastActive = performance.now();
      if (typed === 'treat') {
        pet(4);
        say('A treat?! You’re the best human. 🦴');
        if (G && !reduce) G.fromTo(head, { rotation: 0 }, { rotation: 360, duration: 0.9, ease: 'back.inOut(1.4)', svgOrigin: '48 58' });
        for (let i = 0; i < 5; i++) setTimeout(() => float('♥', (i - 2) * 10), i * 120);
      }
    });
    ['scroll', 'pointerdown', 'pointermove'].forEach((ev) => addEventListener(ev, () => {
      const wasAsleep = el.dataset.mood === 'sleep';
      lastActive = performance.now();
      if (wasAsleep) { setMood('idle'); hop(); say('Oh! I wasn’t sleeping. 👀', 1800); }
    }, { passive: true }));

    // Blinking, dozing off, calming down.
    const blink = () => {
      if (G && !reduce && el.dataset.mood === 'idle') {
        G.timeline().to(lids, { scaleY: 0.1, duration: 0.07 })
          .to(lids, { scaleY: 1, duration: 0.12 });
      }
      setTimeout(blink, 2600 + Math.random() * 3400);
    };
    setTimeout(blink, 2000);
    let zzz = 0;
    setInterval(() => {
      energy *= 0.9;
      if (el.dataset.mood === 'happy' && energy < 0.35) setMood('idle');
      if (el.dataset.mood === 'happy' && Math.random() < 0.45) float('♥', (Math.random() - 0.5) * 24);
      const idleFor = performance.now() - lastActive;
      if (!reduce && el.dataset.mood === 'idle' && idleFor > 25000) setMood('sleep');
      if (el.dataset.mood === 'sleep' && ++zzz % 4 === 0) float('z', 12);
    }, 400);

    // Eyes follow the pointer; head tilts and ears perk up when you come close.
    frameJobs.push(() => {
      if (!el.isConnected) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.55;
      const dx = mouse.x - cx;
      const dy = mouse.y - cy;
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(2.6, d / 60);
      eyes.forEach((eye) => eye.setAttribute('transform', `translate(${((dx / d) * k).toFixed(2)} ${((dy / d) * k).toFixed(2)})`));
      if (!G || reduce || el.dataset.mood !== 'idle') return;
      const close = d < 260;
      G.to(head, { rotation: close ? clamp(dx / 22, -12, 12) : 0, svgOrigin: '48 70', duration: 0.6, ease: 'power3.out', overwrite: 'auto' });
      G.to(ears[0], { rotation: close ? 10 : 0, duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
      G.to(ears[1], { rotation: close ? -10 : 0, duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
      G.to(el, { y: close ? -10 : 0, duration: 0.6, ease: 'power3.out', overwrite: 'auto' });
    });

    // Say hello once per visit, after a moment.
    setTimeout(() => { if (performance.now() - lastBubble > 4000) say('Hi! I’m Byte. Pet me? 🐶'); }, 2800);
    return { say };
  })();

  function addReturnLink() {
    const footer = document.querySelector('footer .wrap, footer');
    if (!footer || footer.querySelector('.pup-return')) return;
    const b = Object.assign(document.createElement('button'), { className: 'pup-return', type: 'button', textContent: '🐾 Bring Byte back' });
    b.addEventListener('click', () => { store.set('pup', 'on'); location.reload(); });
    footer.append(' · ', b);
  }
})();
