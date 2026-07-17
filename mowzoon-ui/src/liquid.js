// Liquid Glass engine - real edge refraction, after kube.io/blog/liquid-glass-css-svg.
// Each [data-liquid] element gets an SVG filter: a displacement map built from
// its rounded-rect geometry (bezel profile + Snell's law, n=1.5), packed into
// the R/G channels of a canvas image (128 = rest) and applied as
// `backdrop-filter: url(#...) blur() saturate()`.
// Chromium-only: other engines (and prefers-reduced-transparency) keep the
// plain blur/saturate cascade from the stylesheet. Map rebuilds are the
// expensive step and animating the filter's `scale` is free, so the settings
// dial drives a multiplier via setLiquidLevel() and maps rebuild on resize.

const SVG_NS = 'http://www.w3.org/2000/svg';
const IOR = 1.5; // glass
const PROFILE_SAMPLES = 128; // ray simulations across the bezel (per the article)

let host = null; // hidden <svg> holding one <filter> per live surface
let seq = 0;
let level = 1; // refraction multiplier from the settings dial
let mo = null;
const tracked = new Map(); // el -> { id, filter, feImage, feDisp, scale, w, h, ro }

// Circular lens profile. The squircle variant flattens so fast the effect
// collapses into a ~3px hairline at the rim; the circle keeps slope (and so
// visible bending) across the whole bezel.
const lensY = (x) => Math.sqrt(1 - (1 - x) * (1 - x));

// One ray per bezel position: surface tilt from the height profile, bend by
// Snell, travel down to the backdrop plane. Output is the horizontal offset
// (px, outward) for that ring. Glass thickness tracks bezel width, so the
// curve is size-invariant.
function buildProfile(bezelPx) {
  const H = bezelPx * 1.1; // virtual glass thickness
  const out = new Float32Array(PROFILE_SAMPLES);
  const delta = 1 / PROFILE_SAMPLES;
  for (let i = 0; i < PROFILE_SAMPLES; i++) {
    const x = i / (PROFILE_SAMPLES - 1);
    const y1 = lensY(Math.max(0, x - delta));
    const y2 = lensY(Math.min(1, x + delta));
    const slope = ((y2 - y1) / (2 * delta)) * (H / bezelPx);
    const theta = Math.atan(slope); // incidence angle on the tilted surface
    const theta2 = Math.asin(Math.min(1, Math.sin(theta) / IOR));
    const deviation = theta - theta2;
    const travel = H * (1.15 - lensY(x)); // remaining glass depth
    out[i] = Math.tan(deviation) * travel;
  }
  return out;
}

// Displacement map for a wxh rounded rect: interior stays neutral grey, the
// bezel ring displaces along the outward SDF normal with the profile above.
// `res` halves the raster for big panels - feImage stretches it back and the
// map is smooth enough that nobody can tell.
function makeMap(w, h, radius, bezelPx, res) {
  const cw = Math.max(2, Math.round(w * res));
  const ch = Math.max(2, Math.round(h * res));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(cw, ch);
  const data = img.data;

  const profile = buildProfile(bezelPx);
  let maxDisp = 0.0001;
  for (const v of profile) maxDisp = Math.max(maxDisp, Math.abs(v));

  const hw = cw / 2;
  const hh = ch / 2;
  const rr = Math.min(radius * res, hw, hh);
  const bez = bezelPx * res;

  for (let py = 0; py < ch; py++) {
    for (let px = 0; px < cw; px++) {
      const cx = px + 0.5 - hw;
      const cy = py + 0.5 - hh;
      const qx = Math.abs(cx) - (hw - rr);
      const qy = Math.abs(cy) - (hh - rr);
      let nx;
      let ny;
      let dist; // distance inward from the boundary
      if (qx > 0 && qy > 0) {
        const len = Math.hypot(qx, qy) || 1;
        dist = rr - len;
        nx = (qx / len) * Math.sign(cx);
        ny = (qy / len) * Math.sign(cy);
      } else if (qx > qy) {
        dist = hw - Math.abs(cx);
        nx = Math.sign(cx);
        ny = 0;
      } else {
        dist = hh - Math.abs(cy);
        nx = 0;
        ny = Math.sign(cy);
      }
      const i = (py * cw + px) * 4;
      if (dist < 0 || dist >= bez) {
        data[i] = 128;
        data[i + 1] = 128;
        data[i + 2] = 128;
        data[i + 3] = 255;
        continue;
      }
      const t = dist / bez;
      const k = profile[Math.min(PROFILE_SAMPLES - 1, Math.round(t * (PROFILE_SAMPLES - 1)))] / maxDisp;
      // rays entering the denser medium bend TOWARD the normal, so bezel
      // pixels sample inward. That's the visible magnify/bulge; the outward
      // sign reads as a smeared emboss instead.
      data[i] = Math.round(128 - nx * k * 127);
      data[i + 1] = Math.round(128 - ny * k * 127);
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { url: canvas.toDataURL(), scale: maxDisp };
}

function ensureHost() {
  if (host) return host;
  host = document.createElementNS(SVG_NS, 'svg');
  host.setAttribute('width', '0');
  host.setAttribute('height', '0');
  host.setAttribute('aria-hidden', 'true');
  host.style.position = 'absolute';
  document.body.appendChild(host);
  return host;
}

function applyScale(rec) {
  // spec: displacement = scale x (channel - 0.5), channel in 0..1 - our
  // encoding peaks at +/-0.5, so scale must be DOUBLE the wanted max px
  rec.feDisp.setAttribute('scale', (rec.scale * 2 * level * rec.strength).toFixed(2));
}

// Coalesced rebuilds: ResizeObserver can fire in bursts while a sheet
// animates open, and each rebuild rasterises a full canvas. setTimeout, not
// rAF - rAF freezes in hidden/backgrounded tabs and would strand a rebuild
// queued while the tab was not visible (e.g. rotation in the background).
let pending = 0;
const dirty = new Set();
function queueRebuild(rec) {
  dirty.add(rec);
  if (pending) return;
  pending = setTimeout(() => {
    pending = 0;
    dirty.forEach(rebuild);
    dirty.clear();
  }, 40);
}

function rebuild(rec) {
  // offsetWidth ignores transforms, so framer's entrance scale never
  // triggers a rebuild at a bogus mid-animation size
  const w = rec.el.offsetWidth;
  const h = rec.el.offsetHeight;
  if (!w || !h) {
    // mounted at zero size (mid-animation / display:none): RO re-fires once
    // layout lands, plus a few timed retries for backgrounded documents
    if ((rec.retries = (rec.retries || 0) + 1) <= 5) setTimeout(() => queueRebuild(rec), 150);
    return;
  }
  rec.retries = 0;
  if (w === rec.w && h === rec.h) return;
  rec.w = w;
  rec.h = h;

  let radius = parseFloat(getComputedStyle(rec.el).borderTopLeftRadius) || 0;
  radius = Math.min(radius, w / 2, h / 2);
  // panels lens only at the rim; small controls (data-liquid-bezel="full")
  // are lens all the way through, like the article's slider/switch demos
  const bezelAttr = rec.el.dataset.liquidBezel;
  let bezel =
    bezelAttr === 'full'
      ? Math.min(w, h) / 2
      : parseFloat(bezelAttr) || Math.max(10, Math.min(radius * 1.4, 40, w / 4, h / 4));
  bezel = Math.max(2, Math.min(bezel, w / 2, h / 2));
  rec.strength = parseFloat(rec.el.dataset.liquidStrength) || 1;
  const res = w * h > 600000 ? 0.5 : 1;

  const { url, scale } = makeMap(w, h, radius, bezel, res);
  rec.scale = scale;
  // decode the map BEFORE the filter references it: feImage renders empty
  // (worst case black) frames while its resource is still loading
  const probe = new Image();
  probe.onload = () => {
    if (tracked.get(rec.el) !== rec) return; // detached meanwhile
    // extend the filter region past the element by the displacement reach,
    // or rim pixels sample beyond the backdrop snapshot and band
    const pad = Math.ceil(scale * rec.strength * 1.3) + 4;
    rec.filter.setAttribute('x', -pad);
    rec.filter.setAttribute('y', -pad);
    rec.filter.setAttribute('width', w + pad * 2);
    rec.filter.setAttribute('height', h + pad * 2);
    rec.feImage.setAttribute('href', url);
    rec.feImage.setAttribute('x', '0');
    rec.feImage.setAttribute('y', '0');
    rec.feImage.setAttribute('width', w);
    rec.feImage.setAttribute('height', h);
    applyScale(rec);

    // small lenses stay near-clear (a panel-strength blur would frost away
    // the refraction entirely on a 24px thumb) - data-liquid-blur="2" pins px
    const blurAttr = rec.el.dataset.liquidBlur;
    const blur = blurAttr != null ? `blur(${parseFloat(blurAttr) || 0}px)` : 'blur(var(--gb))';
    rec.el.style.backdropFilter = `url(#${rec.id}) ${blur} saturate(var(--gs))`;
  };
  probe.src = url;
}

function attach(el) {
  if (tracked.has(el)) {
    // React re-renders rewrite className and can wipe our marker class
    el.classList.add('lg-on');
    return;
  }
  const id = `lg-${++seq}`;
  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.setAttribute('id', id);
  filter.setAttribute('color-interpolation-filters', 'sRGB');
  filter.setAttribute('filterUnits', 'userSpaceOnUse');
  const feImage = document.createElementNS(SVG_NS, 'feImage');
  feImage.setAttribute('result', 'map');
  const feDisp = document.createElementNS(SVG_NS, 'feDisplacementMap');
  feDisp.setAttribute('in', 'SourceGraphic');
  feDisp.setAttribute('in2', 'map');
  feDisp.setAttribute('xChannelSelector', 'R');
  feDisp.setAttribute('yChannelSelector', 'G');
  filter.append(feImage, feDisp);
  ensureHost().appendChild(filter);

  const rec = { el, id, filter, feImage, feDisp, scale: 0, strength: 1, w: 0, h: 0, ro: null };
  rec.ro = new ResizeObserver(() => queueRebuild(rec));
  rec.ro.observe(el);
  tracked.set(el, rec);
  el.classList.add('lg-on'); // lets CSS thin out materials only when lensing runs
  rebuild(rec);
}

function detach(el) {
  const rec = tracked.get(el);
  if (!rec) return;
  rec.ro.disconnect();
  rec.filter.remove();
  el.style.backdropFilter = '';
  el.classList.remove('lg-on');
  tracked.delete(el);
}

function scan(node) {
  if (node.nodeType !== 1) return;
  if (node.matches?.('[data-liquid]')) attach(node);
  node.querySelectorAll?.('[data-liquid]').forEach(attach);
}

export function setLiquidLevel(mult) {
  level = mult;
  tracked.forEach(applyScale);
}

export function initLiquid() {
  if (mo || typeof window === 'undefined') return;
  // Chromium-only: other engines drop url() in backdrop-filter entirely,
  // which would kill even the blur. They keep the stylesheet fallback.
  const chromium = 'chrome' in window;
  const reduced = window.matchMedia('(prefers-reduced-transparency: reduce)').matches;
  if (!chromium || reduced) return;
  ensureHost();
  scan(document.body);
  mo = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'attributes') {
        // covers elements that gain/lose the tag in place (e.g. HMR patches)
        if (m.target.hasAttribute('data-liquid')) attach(m.target);
        else if (tracked.has(m.target)) detach(m.target);
        continue;
      }
      m.addedNodes.forEach(scan);
      m.removedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        if (tracked.has(n)) detach(n);
        n.querySelectorAll?.('[data-liquid]').forEach((el) => {
          if (tracked.has(el)) detach(el);
        });
      });
    }
  });
  mo.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-liquid'],
  });
  // Media-query flips (tabbar/crumb appearing at phone widths) change sizes
  // while ResizeObserver may have no rendering opportunity to deliver -
  // rebuild() no-ops on unchanged sizes, so sweeping everything is cheap.
  window.addEventListener('resize', () => tracked.forEach(queueRebuild));
  // Reconciliation net: attach anything the mutation stream missed (HMR
  // patches, exotic mounts). ~10 nodes to check; attach() no-ops when tracked.
  setInterval(() => scan(document.body), 2000);
}
