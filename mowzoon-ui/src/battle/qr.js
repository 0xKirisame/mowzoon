// Minimal QR code generator (byte mode, ECC level M, versions 1-10).
// Follows the ISO/IEC 18004 algorithm in the style of Project Nayuki's
// qrcodegen: data -> bit stream -> Reed-Solomon blocks -> matrix -> best mask.
// Plenty for a share URL; returns a boolean module matrix the UI renders as
// SVG. No dependencies.

// --- tables (ECC level M, versions 1-10) ------------------------------------
const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const NUM_BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const ECC_FORMAT_BITS = 0; // level M

const MAX_VERSION = 10;

function numRawDataModules(ver) {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

const numDataCodewords = (ver) =>
  Math.floor(numRawDataModules(ver) / 8) - ECC_PER_BLOCK[ver] * NUM_BLOCKS[ver];

const charCountBits = (ver) => (ver <= 9 ? 8 : 16);

// --- Reed-Solomon over GF(256), poly 0x11D ----------------------------------
function rsMultiply(a, b) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((b >>> i) & 1) * a;
  }
  return z;
}

function rsDivisor(degree) {
  const result = new Array(degree - 1).fill(0).concat([1]);
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = rsMultiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = rsMultiply(root, 0x02);
  }
  return result;
}

function rsRemainder(data, divisor) {
  const result = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ result.shift();
    result.push(0);
    divisor.forEach((coef, i) => { result[i] ^= rsMultiply(coef, factor); });
  }
  return result;
}

// --- encode ------------------------------------------------------------------
function utf8Bytes(str) {
  if (typeof TextEncoder === 'function') return Array.from(new TextEncoder().encode(str));
  const out = [];
  const esc = unescape(encodeURIComponent(str));
  for (let i = 0; i < esc.length; i++) out.push(esc.charCodeAt(i));
  return out;
}

function buildCodewords(bytes, ver) {
  // bit buffer: mode 0100, char count, data, terminator, byte-align, pads
  const bits = [];
  const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  push(4, 4);
  push(bytes.length, charCountBits(ver));
  for (const b of bytes) push(b, 8);
  const capacity = numDataCodewords(ver) * 8;
  push(0, Math.min(4, capacity - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);

  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    data.push(b);
  }

  // split into blocks, add ECC, interleave
  const numBlocks = NUM_BLOCKS[ver];
  const eccLen = ECC_PER_BLOCK[ver];
  const rawCodewords = Math.floor(numRawDataModules(ver) / 8);
  const numShort = numBlocks - (rawCodewords % numBlocks);
  const shortLen = Math.floor(rawCodewords / numBlocks);
  const divisor = rsDivisor(eccLen);
  const blocks = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1));
    k += dat.length;
    const ecc = rsRemainder(dat, divisor);
    if (i < numShort) dat.push(-1); // placeholder to align columns
    blocks.push(dat.concat(ecc));
  }
  const result = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortLen - eccLen || j >= numShort) result.push(block[i]);
    });
  }
  return result;
}

// --- matrix ------------------------------------------------------------------
function alignmentPositions(ver) {
  if (ver === 1) return [];
  const size = ver * 4 + 17;
  const numAlign = Math.floor(ver / 7) + 2;
  const step = Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

const getBit = (x, i) => ((x >>> i) & 1) !== 0;

function makeGrid(ver) {
  const size = ver * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const isFunc = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, dark) => { modules[y][x] = dark; isFunc[y][x] = true; };

  // timing patterns
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  // finder patterns + separators
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
      }
    }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);
  // alignment patterns
  const align = alignmentPositions(ver);
  const last = align.length - 1;
  for (let i = 0; i < align.length; i++) {
    for (let j = 0; j < align.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          set(align[i] + dx, align[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }
  // version info (v7+)
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, getBit(bits, i));
      set(b, a, getBit(bits, i));
    }
  }
  // reserve format areas (drawn per-mask later)
  drawFormat(modules, isFunc, size, 0);
  return { size, modules, isFunc };
}

function drawFormat(modules, isFunc, size, mask) {
  const data = (ECC_FORMAT_BITS << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const set = (x, y, dark) => { modules[y][x] = dark; isFunc[y][x] = true; };
  for (let i = 0; i <= 5; i++) set(8, i, getBit(bits, i));
  set(8, 7, getBit(bits, 6));
  set(8, 8, getBit(bits, 7));
  set(7, 8, getBit(bits, 8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, getBit(bits, i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, getBit(bits, i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, getBit(bits, i));
  set(8, size - 8, true); // dark module
}

function drawCodewords(modules, isFunc, size, data) {
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFunc[y][x] && i < data.length * 8) {
          modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
          i++;
        }
      }
    }
  }
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function applyMask(modules, isFunc, size, mask) {
  const fn = MASKS[mask];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isFunc[y][x] && fn(x, y)) modules[y][x] = !modules[y][x];
    }
  }
}

// classic penalty rules N1-N4
function penalty(modules, size) {
  let score = 0;
  const runPenalty = (line) => {
    let s = 0;
    let run = 1;
    for (let i = 1; i <= size; i++) {
      if (i < size && line(i) === line(i - 1)) run++;
      else { if (run >= 5) s += 3 + (run - 5); run = 1; }
    }
    return s;
  };
  const finderPenalty = (line) => {
    // 1:1:3:1:1 dark pattern flanked by 4 light modules on either side
    let s = 0;
    const bits = [];
    for (let i = 0; i < size; i++) bits.push(line(i) ? 1 : 0);
    const pat1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    const pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    for (let i = 0; i + 11 <= size; i++) {
      const w = bits.slice(i, i + 11);
      if (pat1.every((v, k) => v === w[k]) || pat2.every((v, k) => v === w[k])) s += 40;
    }
    return s;
  };
  let dark = 0;
  for (let y = 0; y < size; y++) {
    score += runPenalty((x) => modules[y][x]) + finderPenalty((x) => modules[y][x]);
    for (let x = 0; x < size; x++) {
      if (modules[y][x]) dark++;
      if (x + 1 < size && y + 1 < size
        && modules[y][x] === modules[y][x + 1]
        && modules[y][x] === modules[y + 1][x]
        && modules[y][x] === modules[y + 1][x + 1]) score += 3;
    }
  }
  for (let x = 0; x < size; x++) {
    score += runPenalty((y) => modules[y][x]) + finderPenalty((y) => modules[y][x]);
  }
  const pct = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

// --- public API ---------------------------------------------------------------
// qrMatrix(text) -> { size, modules, isFunc, version, mask } | null (too long)
export function qrMatrix(text) {
  const bytes = utf8Bytes(text);
  let ver = 0;
  for (let v = 1; v <= MAX_VERSION; v++) {
    if (numDataCodewords(v) * 8 >= 4 + charCountBits(v) + 8 * bytes.length) { ver = v; break; }
  }
  if (!ver) return null;

  const codewords = buildCodewords(bytes, ver);
  const { size, modules, isFunc } = makeGrid(ver);
  drawCodewords(modules, isFunc, size, codewords);

  let best = 0;
  let bestScore = Infinity;
  for (let m = 0; m < 8; m++) {
    applyMask(modules, isFunc, size, m);
    drawFormat(modules, isFunc, size, m);
    const s = penalty(modules, size);
    if (s < bestScore) { bestScore = s; best = m; }
    applyMask(modules, isFunc, size, m); // undo (XOR twice)
  }
  applyMask(modules, isFunc, size, best);
  drawFormat(modules, isFunc, size, best);
  return { size, modules, isFunc, version: ver, mask: best };
}

// Render a matrix to a single SVG path string ("M.. h1v1h-1z" per module is
// heavy; one rect-run per row keeps it tiny). Quiet zone handled by the caller.
export function qrPath(matrix) {
  const { size, modules } = matrix;
  let d = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!modules[y][x]) continue;
      let w = 1;
      while (x + w < size && modules[y][x + w]) w++;
      d += `M${x} ${y}h${w}v1h-${w}z`;
      x += w - 1;
    }
  }
  return d;
}
