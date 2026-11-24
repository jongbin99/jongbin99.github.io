/* Particle constellations + scroll reveal. No dependencies. */
(() => {
  'use strict';

  // violet, amber, teal, magenta, blue, lilac
  const PALETTE = ['#8052ff', '#ffb829', '#1fa88c', '#ff4fc3', '#3f8cff', '#b79bff'];
  const ALPHAS = [0.28, 0.58, 0.95];
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const TAU = Math.PI * 2;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (k) => 1 - Math.pow(1 - k, 3);
  const pick = () => (Math.random() * PALETTE.length) | 0;

  /* ---------- Shapes: each returns [x, y, z, colorIndex] in roughly -1..1 ---------- */

  const ell = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;

  // Side-view brain silhouette, facing left. Returns a region id or 0.
  function brainRegion(x, y) {
    if (ell(x, y, 0.6, 0.6, 0.3, 0.19)) return 5;                                   // cerebellum
    if (y > 0.45 && y < 0.98 && Math.abs(x - (0.2 + (y - 0.45) * 0.3)) < 0.08) return 6; // stem
    if (ell(x, y, -0.12, 0.4, 0.52, 0.25)) return 4;                                // temporal
    const upper =
      (ell(x, y, -0.02, -0.12, 1.0, 0.7) && y < 0.36) ||
      ell(x, y, -0.55, 0.06, 0.42, 0.44) ||
      ell(x, y, 0.62, 0.08, 0.4, 0.46);
    if (!upper) return 0;
    if (x < -0.3) return 1;                                                          // frontal
    if (x > 0.48) return 3;                                                          // occipital
    return 2;                                                                        // parietal
  }
  const REGION_COLOR = [0, 0, 4, 3, 1, 2, 5];

  const shapes = {
    brain(n) {
      const out = [];
      let guard = 0;
      while (out.length < n && guard++ < n * 60) {
        const x = rnd(-1.1, 1.1);
        const y = rnd(-0.85, 1.0);
        const region = brainRegion(x, y);
        if (!region) continue;
        // Thin the cloud along warped bands so it reads as folds, not a blob.
        const fold = region === 5
          ? Math.abs(Math.sin(38 * y + 7 * x))
          : Math.abs(Math.sin(8.5 * x + 3 * Math.sin(5 * y + 1.3 * x)) * Math.sin(7 * y + 2.5 * Math.sin(4 * x)));
        if (Math.random() > 0.03 + 0.97 * Math.pow(fold, 1.5)) continue;
        const depth = 0.55 * Math.sqrt(Math.max(0, 1 - (x * x + (y / 0.8) ** 2) * 0.9));
        const ci = Math.random() < 0.62 ? REGION_COLOR[region] : pick();
        out.push([x, y - 0.08, rnd(-depth, depth), ci]);
      }
      return out;
    },

    helix(n) {
      const out = [];
      const r = 0.36;
      const turns = 2.4;
      for (let i = 0; i < n; i++) {
        const t = rnd(-1, 1);
        const a = t * turns * Math.PI;
        const j = () => rnd(-0.035, 0.035);
        const kind = Math.random();
        if (kind < 0.36) {
          out.push([r * Math.cos(a) + j(), t + j(), r * Math.sin(a) + j(), 0]);
        } else if (kind < 0.72) {
          out.push([-r * Math.cos(a) + j(), t + j(), -r * Math.sin(a) + j(), 2]);
        } else {
          // rungs, snapped to evenly spaced steps
          const ts = Math.round(t * 13) / 13;
          const as = ts * turns * Math.PI;
          const u = rnd(-1, 1);
          out.push([u * r * Math.cos(as) + j() * 0.5, ts + j() * 0.4, u * r * Math.sin(as) + j() * 0.5, u < 0 ? 1 : 3]);
        }
      }
      return out;
    },

    sphere(n) {
      const out = [];
      for (let i = 0; i < n; i++) {
        const u = rnd(-1, 1);
        const a = rnd(0, TAU);
        const s = Math.sqrt(1 - u * u);
        const r = 0.82 + rnd(-0.03, 0.03);
        out.push([r * s * Math.cos(a), r * u, r * s * Math.sin(a), pick()]);
      }
      return out;
    },
  };

  const CONFIG = {
    brain:  { count: 3000, fw: 0.43, fh: 0.5,  scatter: 0.1,  spin: 0,    tilt: 0,     size: [1.6, 4.2] },
    helix:  { count: 1100, fw: 0.46, fh: 0.44, scatter: 0.06, spin: 0.35, tilt: -0.38, size: [1.8, 4.4] },
    sphere: { count: 520,  fw: 0.42, fh: 0.34, scatter: 0,    spin: 0.18, tilt: 0.3,   size: [1.8, 4.0] },
  };

  /* ---------- Triangle batch renderer ---------- */

  function makeBuckets() {
    return Array.from({ length: PALETTE.length * ALPHAS.length }, () => []);
  }

  function drawBuckets(ctx, buckets) {
    ctx.lineWidth = 1;
    ctx.lineJoin = 'miter';
    for (let b = 0; b < buckets.length; b++) {
      const list = buckets[b];
      if (!list.length) continue;
      ctx.strokeStyle = PALETTE[(b / ALPHAS.length) | 0];
      ctx.globalAlpha = ALPHAS[b % ALPHAS.length];
      ctx.beginPath();
      for (let i = 0; i < list.length; i += 4) {
        const x = list[i], y = list[i + 1], s = list[i + 2], r = list[i + 3];
        ctx.moveTo(x + s * Math.cos(r), y + s * Math.sin(r));
        ctx.lineTo(x + s * Math.cos(r + 2.0944), y + s * Math.sin(r + 2.0944));
        ctx.lineTo(x + s * Math.cos(r + 4.1888), y + s * Math.sin(r + 4.1888));
        ctx.closePath();
      }
      ctx.stroke();
      list.length = 0;
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- Constellation field ---------- */

  class Field {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.cfg = CONFIG[canvas.dataset.shape] || CONFIG.sphere;
      this.buckets = makeBuckets();
      this.visible = false;
      this.started = null;
      this.w = this.h = 0;
      this.mx = 0; this.my = 0;       // smoothed pointer, -1..1 across the viewport
      this.px = -9999; this.py = -9999; // pointer in canvas pixels

      const small = window.innerWidth < 700;
      const count = Math.round(this.cfg.count * (small ? 0.55 : 1));
      const [s0, s1] = this.cfg.size;
      const core = shapes[canvas.dataset.shape](count);
      this.pts = core.map(([x, y, z, ci]) => this.particle(x, y, z, ci, rnd(s0, s1), rnd(0.55, 1)));
      // loose strays around the form
      const strays = Math.round(count * this.cfg.scatter);
      for (let i = 0; i < strays; i++) {
        const a = rnd(0, TAU), d = rnd(1.05, 2.1);
        this.pts.push(this.particle(Math.cos(a) * d, Math.sin(a) * d * 0.8, rnd(-0.5, 0.5), pick(), rnd(s0, s1 * 1.4), rnd(0.25, 0.6)));
      }

      new ResizeObserver(() => this.resize()).observe(canvas);
      new IntersectionObserver(([e]) => {
        this.visible = e.isIntersecting;
        if (this.visible && REDUCED) this.frame(0);
      }, { rootMargin: '80px' }).observe(canvas);
      this.resize();
    }

    particle(x, y, z, ci, size, alpha) {
      return {
        x, y, z, ci, size, alpha,
        rot: rnd(0, TAU), spin: rnd(-0.6, 0.6),
        ph: rnd(0, TAU), tw: rnd(0.4, 1.6),
        ox: rnd(-1, 1), oy: rnd(-1, 1), delay: rnd(0, 0.9),
      };
    }

    resize() {
      const r = this.canvas.getBoundingClientRect();
      this.w = r.width; this.h = r.height;
      this.canvas.width = Math.round(r.width * DPR);
      this.canvas.height = Math.round(r.height * DPR);
      this.ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      if (REDUCED) this.frame(0);
    }

    pointer(e) {
      const r = this.canvas.getBoundingClientRect();
      this.px = e.clientX - r.left;
      this.py = e.clientY - r.top;
    }

    frame(t) {
      const { ctx, w, h, cfg, buckets } = this;
      if (!w || !h) return;
      if (this.started === null) this.started = t;
      const el = REDUCED ? 99 : t - this.started;

      this.mx += (pointerN.x - this.mx) * 0.04;
      this.my += (pointerN.y - this.my) * 0.04;

      const s = Math.min(w * cfg.fw, h * cfg.fh);
      const cx = w / 2, cy = h / 2;
      const ang = cfg.spin ? t * cfg.spin + this.mx * 0.4 : Math.sin(t * 0.22) * 0.3 + this.mx * 0.28;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const ct = Math.cos(cfg.tilt), st = Math.sin(cfg.tilt);
      const pitch = this.my * 0.12;
      const R = 110;

      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < this.pts.length; i++) {
        const p = this.pts[i];
        let X = p.x * ca + p.z * sa;
        let Z = -p.x * sa + p.z * ca;
        let Y = p.y + Z * pitch;
        if (cfg.tilt) { const tx = X * ct - Y * st; Y = X * st + Y * ct; X = tx; }
        const persp = 1 / (1 - Z * 0.26);
        let x = cx + X * s * persp;
        let y = cy + Y * s * persp;

        const k = ease(clamp((el - p.delay) / 1.7, 0, 1));
        if (k < 1) { x += p.ox * w * 0.6 * (1 - k); y += p.oy * h * 0.6 * (1 - k); }

        const dx = x - this.px, dy = y - this.py;
        const d2 = dx * dx + dy * dy;
        if (d2 < R * R && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const f = (1 - d / R) ** 2 * 34;
          x += (dx / d) * f; y += (dy / d) * f;
        }

        const tw = REDUCED ? 0.85 : 0.62 + 0.38 * Math.sin(t * p.tw + p.ph);
        const a = p.alpha * tw * clamp(0.72 + Z * 0.5, 0.35, 1) * k;
        const bucket = p.ci * ALPHAS.length + clamp((a * 3) | 0, 0, 2);
        buckets[bucket].push(x, y, p.size * persp, p.rot + (REDUCED ? 0 : t * p.spin));
      }
      drawBuckets(ctx, buckets);
    }
  }

  /* ---------- Ambient drift across the whole page ---------- */

  class Ambient {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.buckets = makeBuckets();
      this.visible = true;
      const n = window.innerWidth < 700 ? 34 : 70;
      this.pts = Array.from({ length: n }, () => ({
        x: Math.random(), y: Math.random(),
        vx: rnd(-0.004, 0.004), vy: rnd(-0.006, -0.001),
        depth: rnd(0.2, 1), size: rnd(2.5, 7), ci: pick(),
        rot: rnd(0, TAU), spin: rnd(-0.25, 0.25),
      }));
      window.addEventListener('resize', () => this.resize());
      this.resize();
    }

    resize() {
      this.w = window.innerWidth; this.h = window.innerHeight;
      this.canvas.width = Math.round(this.w * DPR);
      this.canvas.height = Math.round(this.h * DPR);
      this.ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      if (REDUCED) this.frame(0);
    }

    frame(t) {
      const { ctx, w, h, buckets } = this;
      const pad = 40, H = h + pad * 2, W = w + pad * 2;
      const scroll = window.scrollY;
      ctx.clearRect(0, 0, w, h);
      for (const p of this.pts) {
        const x = (((p.x + p.vx * t) % 1 + 1) % 1) * W - pad;
        const y = ((((p.y + p.vy * t) * H - scroll * p.depth * 0.25) % H) + H) % H - pad;
        buckets[p.ci * ALPHAS.length + (p.depth > 0.75 ? 1 : 0)].push(x, y, p.size * (0.6 + p.depth * 0.6), p.rot + t * p.spin);
      }
      drawBuckets(ctx, buckets);
    }
  }

  /* ---------- Boot ---------- */

  const pointerN = { x: 0, y: 0 };
  const fields = [...document.querySelectorAll('canvas.field')].map((c) => new Field(c));
  const ambient = new Ambient(document.getElementById('ambient'));

  window.addEventListener('pointermove', (e) => {
    pointerN.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointerN.y = (e.clientY / window.innerHeight) * 2 - 1;
    for (const f of fields) if (f.visible) f.pointer(e);
  }, { passive: true });
  document.addEventListener('pointerleave', () => { for (const f of fields) { f.px = f.py = -9999; } });

  if (REDUCED) {
    window.addEventListener('scroll', () => ambient.frame(0), { passive: true });
  } else {
    const loop = (ms) => {
      const t = ms / 1000;
      if (!document.hidden) {
        ambient.frame(t);
        for (const f of fields) if (f.visible) f.frame(t);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /* ---------- Background video: scroll dimming, pointer parallax ---------- */

  const video = document.getElementById('bg-video');
  const wrap = video && video.parentElement;
  if (video) {
    // Plays on load (the tag carries autoplay); only held back for prefers-reduced-motion.
    if (REDUCED) video.pause(); else video.play().catch(() => {});
    // Servers without byte-range support can't seek, so the native loop may stall; restart by hand.
    video.addEventListener('ended', () => { if (!REDUCED) { video.load(); video.play().catch(() => {}); } });

    // Bright in the hero, receding to a faint backdrop once you scroll into the text.
    const dim = () => {
      const k = clamp(window.scrollY / (window.innerHeight * 0.8), 0, 1);
      wrap.style.setProperty('--bg-opacity', (0.85 - 0.71 * k).toFixed(3));
    };
    window.addEventListener('scroll', dim, { passive: true });
    dim();

    let px = 0, py = 0;
    const tick = () => {
      if (!REDUCED) {
        px += (pointerN.x * -14 - px) * 0.05;
        py += (pointerN.y * -10 - py) * 0.05;
        wrap.style.setProperty('--px', px.toFixed(1) + 'px');
        wrap.style.setProperty('--py', py.toFixed(1) + 'px');
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- Scroll reveal + active nav ---------- */

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }
  }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
})();
