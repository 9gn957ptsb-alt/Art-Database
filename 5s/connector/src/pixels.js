/* A picture's colours, surface and texture, read on the server the way the 5s app reads them on its
 * canvas (5s/src/bring.js, FiveSBring.process): the same three dominant colours (k-means, k = 5, on
 * a 96 px copy), the same surface window (searched on a copy 128 px on its shorter edge) and the same
 * texture scale (edge density of that window at 512 px). The measuring functions are the app's own,
 * imported unchanged from bring.js (src/bring.js here); only the decoding and resampling are here, because a Worker has
 * no canvas: JPEG through jpeg-js (pure JavaScript, bundled by wrangler), PNG through a small decoder
 * below on the platform's DecompressionStream. GIF, WebP and AVIF are recognised and measured (their
 * size, from the header) but not decoded: those are left to the app.
 *
 * Decoding costs CPU (about 140 ms a megapixel for a JPEG, measured under Node 22; the analysis
 * about 70 ms more per picture), and a Worker's clock does not move while it computes, so the budget
 * is counted in pixels, not milliseconds: see bring_in in tools.js.
 */
import jpeg from 'jpeg-js';
import { measures as B } from './bring.js';

// The app's sizes (bring.js): the working copy, the colour copy, the surface search, the texture.
const MAX_EDGE = 720;
const COLOUR_EDGE = 96;
const ANALYSIS_SHORT = 128;
const TEX_SIDE = 512;

const round = (v, dp) => { const f = Math.pow(10, dp); return Math.round(v * f) / f; };
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Fit (w, h) inside a long edge, never enlarging (bring.js fit). */
export function fit(w, h, edge) {
  const s = Math.min(1, edge / Math.max(w, h));
  return [Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))];
}

// ------------------------------------------------------------------ what a file is

const MIME = { jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif' };
export const mimeOf = (type) => MIME[type] || null;

/** What a picture file is, from its first bytes (never from what the site says it is). */
export function sniff(b) {
  if (!b || b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'png';
  const ascii = (i, n) => String.fromCharCode.apply(null, Array.from(b.subarray(i, i + n)));
  if (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a') return 'gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'webp';
  if (ascii(4, 4) === 'ftyp' && /^(avif|avis)$/.test(ascii(8, 4))) return 'avif';
  return null;
}

const u16be = (b, i) => (b[i] << 8) | b[i + 1];
const u32be = (b, i) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
const u16le = (b, i) => b[i] | (b[i + 1] << 8);
const u24le = (b, i) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);

/** The EXIF orientation (1–8) of a JPEG, from its APP1 segment; 1 when there is none. */
export function jpegOrientation(b) {
  let i = 2;
  while (i + 4 < b.length && b[i] === 0xff) {
    const marker = b[i + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const len = u16be(b, i + 2);
    if (marker === 0xe1 && len > 14 && String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]) === 'Exif') {
      const t = i + 10;                                   // the TIFF header
      if (t + 8 > b.length) break;
      const le = b[t] === 0x49;
      const r16 = (k) => (le ? u16le(b, k) : u16be(b, k));
      const r32 = (k) => (le ? (b[k] | (b[k + 1] << 8) | (b[k + 2] << 16) | (b[k + 3] << 24)) >>> 0 : u32be(b, k));
      const ifd = t + r32(t + 4);
      if (ifd + 2 > b.length) break;
      const n = r16(ifd);
      for (let e = 0; e < n; e++) {
        const at = ifd + 2 + e * 12;
        if (at + 12 > b.length) break;
        if (r16(at) === 0x0112) { const v = r16(at + 8); return v >= 1 && v <= 8 ? v : 1; }
      }
      break;
    }
    i += 2 + len;
  }
  return 1;
}

/** {w, h} from a picture's header (as it will show: a JPEG turned by its EXIF orientation), or null. */
export function dimensions(b, type) {
  try {
    if (type === 'png' && b.length >= 24) return { w: u32be(b, 16), h: u32be(b, 20) };
    if (type === 'gif') return { w: u16le(b, 6), h: u16le(b, 8) };
    if (type === 'jpeg') {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m === 0xff) { i++; continue; }
        if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) { i += 2; continue; }
        const len = u16be(b, i + 2);
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
          const h = u16be(b, i + 5), w = u16be(b, i + 7);
          return jpegOrientation(b) >= 5 ? { w: h, h: w } : { w, h };
        }
        if (m === 0xda) break;
        i += 2 + len;
      }
      return null;
    }
    if (type === 'webp' && b.length >= 30) {
      const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
      if (chunk === 'VP8X') return { w: 1 + u24le(b, 24), h: 1 + u24le(b, 27) };
      if (chunk === 'VP8L') { const v = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24); return { w: 1 + (v & 0x3fff), h: 1 + ((v >>> 14) & 0x3fff) }; }
      if (chunk === 'VP8 ') return { w: u16le(b, 26) & 0x3fff, h: u16le(b, 28) & 0x3fff };
    }
  } catch { /* a header cut short */ }
  return null;
}

// ------------------------------------------------------------------ PNG

/** Inflate zlib data with the platform's DecompressionStream, refusing more than `max` bytes out. */
async function inflate(data, max) {
  const ds = new DecompressionStream('deflate');
  const writer = ds.writable.getWriter();
  writer.write(data).catch(() => {});
  writer.close().catch(() => {});
  const reader = ds.readable.getReader();
  const out = new Uint8Array(max);
  let n = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (n + value.length > max) { await reader.cancel().catch(() => {}); throw new Error('more pixels than the header said'); }
      out.set(value, n);
      n += value.length;
    }
  } catch (e) {
    if (n < max) throw e;   // a stream with trailing bytes after the image: the image itself is whole
  }
  return n === max ? out : out.subarray(0, n);
}

function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/**
 * decodePng(bytes, maxPx) -> {w, h, data: RGBA}, or null for a PNG this decoder leaves to the app
 * (interlaced, or bigger than maxPx). Throws on a broken file. Every colour type and bit depth.
 */
export async function decodePng(b, maxPx) {
  if (sniff(b) !== 'png') throw new Error('not a PNG');
  let i = 8, w = 0, h = 0, depth = 0, ctype = 0, interlace = 0, palette = null, trns = null;
  const idat = [];
  let idatLen = 0;
  while (i + 8 <= b.length) {
    const len = u32be(b, i);
    const type = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
    const d = b.subarray(i + 8, i + 8 + len);
    if (d.length < len) throw new Error('PNG cut short');
    if (type === 'IHDR') { w = u32be(d, 0); h = u32be(d, 4); depth = d[8]; ctype = d[9]; interlace = d[12]; }
    else if (type === 'PLTE') palette = d;
    else if (type === 'tRNS') trns = d;
    else if (type === 'IDAT') { idat.push(d); idatLen += d.length; }
    else if (type === 'IEND') break;
    i += 12 + len;
  }
  if (!w || !h) throw new Error('PNG without a header');
  if (w * h > maxPx || interlace) return null;
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype];
  if (!channels || ![1, 2, 4, 8, 16].includes(depth) || (ctype === 3 && !palette)) throw new Error('PNG of an unknown kind');
  const bpp = channels * depth;                   // bits per pixel
  const rowBytes = Math.ceil(w * bpp / 8);
  const step = Math.max(1, bpp >> 3);              // bytes to the pixel on the left, for the filters
  const z = new Uint8Array(idatLen);
  let at = 0;
  for (const d of idat) { z.set(d, at); at += d.length; }
  const raw = await inflate(z, h * (rowBytes + 1));
  if (raw.length < h * (rowBytes + 1)) throw new Error('PNG pixels cut short');
  const px = new Uint8Array(h * rowBytes);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (rowBytes + 1)];
    const src = y * (rowBytes + 1) + 1, row = y * rowBytes, up = row - rowBytes;
    for (let x = 0; x < rowBytes; x++) {
      const a = x >= step ? px[row + x - step] : 0;
      const u = y > 0 ? px[up + x] : 0;
      const c = x >= step && y > 0 ? px[up + x - step] : 0;
      const v = raw[src + x];
      px[row + x] = f === 0 ? v : f === 1 ? v + a : f === 2 ? v + u : f === 3 ? v + ((a + u) >> 1) : f === 4 ? v + paeth(a, u, c) : v;
    }
  }
  const out = new Uint8Array(w * h * 4);
  const maxV = (1 << depth) - 1;
  const sample = (row, k) => {                     // the k-th sample of a row, at its own depth
    if (depth === 8) return px[row + k];
    if (depth === 16) return (px[row + 2 * k] << 8) | px[row + 2 * k + 1];
    const bit = k * depth;
    return (px[row + (bit >> 3)] >> (8 - depth - (bit & 7))) & maxV;
  };
  const to8 = (v) => (depth === 16 ? v >> 8 : depth === 8 ? v : Math.round(v * 255 / maxV));
  const tGrey = trns && ctype === 0 && trns.length >= 2 ? u16be(trns, 0) : -1;
  const tRgb = trns && ctype === 2 && trns.length >= 6 ? [u16be(trns, 0), u16be(trns, 2), u16be(trns, 4)] : null;
  for (let y = 0; y < h; y++) {
    const row = y * rowBytes;
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (ctype === 0) {
        const g = sample(row, x);
        out[o] = out[o + 1] = out[o + 2] = to8(g); out[o + 3] = g === tGrey ? 0 : 255;
      } else if (ctype === 2) {
        const r = sample(row, 3 * x), g = sample(row, 3 * x + 1), bl = sample(row, 3 * x + 2);
        out[o] = to8(r); out[o + 1] = to8(g); out[o + 2] = to8(bl);
        out[o + 3] = tRgb && r === tRgb[0] && g === tRgb[1] && bl === tRgb[2] ? 0 : 255;
      } else if (ctype === 3) {
        const k = sample(row, x);
        out[o] = palette[3 * k] || 0; out[o + 1] = palette[3 * k + 1] || 0; out[o + 2] = palette[3 * k + 2] || 0;
        out[o + 3] = trns && k < trns.length ? trns[k] : 255;
      } else if (ctype === 4) {
        const g = to8(sample(row, 2 * x));
        out[o] = out[o + 1] = out[o + 2] = g; out[o + 3] = to8(sample(row, 2 * x + 1));
      } else {
        out[o] = to8(sample(row, 4 * x)); out[o + 1] = to8(sample(row, 4 * x + 1));
        out[o + 2] = to8(sample(row, 4 * x + 2)); out[o + 3] = to8(sample(row, 4 * x + 3));
      }
    }
  }
  return { w, h, data: out };
}

// ------------------------------------------------------------------ JPEG

/** decodeJpeg(bytes, maxPx) -> {w, h, data: RGBA} turned upright by its EXIF orientation, or null
 *  when it is bigger than maxPx. Throws on a broken file. */
export function decodeJpeg(b, maxPx) {
  const dim = dimensions(b, 'jpeg');
  if (!dim) throw new Error('JPEG without a frame header');
  if (dim.w * dim.h > maxPx) return null;
  const img = jpeg.decode(b, { useTArray: true, formatAsRGBA: true, tolerantDecoding: true,
    maxResolutionInMP: Math.max(1, maxPx / 1e6), maxMemoryUsageInMB: 64 });
  return orient({ w: img.width, h: img.height, data: img.data }, jpegOrientation(b));
}

/** Turn RGBA pixels by an EXIF orientation (2–8), as a browser shows them. */
export function orient(img, o) {
  if (!(o >= 2 && o <= 8)) return img;
  const { w, h, data } = img;
  const swap = o >= 5;
  const W = swap ? h : w, H = swap ? w : h;
  const out = new Uint8Array(W * H * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let X, Y;
      switch (o) {
        case 2: X = w - 1 - x; Y = y; break;
        case 3: X = w - 1 - x; Y = h - 1 - y; break;
        case 4: X = x; Y = h - 1 - y; break;
        case 5: X = y; Y = x; break;
        case 6: X = h - 1 - y; Y = x; break;
        case 7: X = h - 1 - y; Y = w - 1 - x; break;
        default: X = y; Y = w - 1 - x; break;   // 8
      }
      const s = (y * w + x) * 4, d = (Y * W + X) * 4;
      out[d] = data[s]; out[d + 1] = data[s + 1]; out[d + 2] = data[s + 2]; out[d + 3] = data[s + 3];
    }
  }
  return { w: W, h: H, data: out };
}

/** Decode a JPEG or PNG no bigger than maxPx; null for anything else (or bigger). */
export async function decode(bytes, type, maxPx) {
  if (type === 'jpeg') return decodeJpeg(bytes, maxPx);
  if (type === 'png') return decodePng(bytes, maxPx);
  return null;
}

// ------------------------------------------------------------------ resampling

// One axis of a resample: for each output position, the source positions and weights. Shrinking
// averages every source pixel the output pixel covers (fractional at the edges); enlarging blends
// the two nearest (bilinear). Close to a canvas's smoothed drawImage, and the same in every run.
function weights(srcStart, srcLen, srcMax, outLen) {
  const scale = srcLen / outLen;
  const idx = [], wts = [];
  for (let o = 0; o < outLen; o++) {
    const i = [], w = [];
    if (scale > 1) {
      const a = srcStart + o * scale, b = a + scale;
      for (let s = Math.floor(a); s < Math.ceil(b); s++) {
        const cover = Math.min(b, s + 1) - Math.max(a, s);
        if (cover > 0) { i.push(clamp(s, 0, srcMax - 1)); w.push(cover / scale); }
      }
    } else {
      const c = srcStart + (o + 0.5) * scale - 0.5;
      const s0 = Math.floor(c), t = c - s0;
      i.push(clamp(s0, 0, srcMax - 1), clamp(s0 + 1, 0, srcMax - 1));
      w.push(1 - t, t);
    }
    idx.push(i); wts.push(w);
  }
  return { idx, wts };
}

/**
 * resample(data, w, h, rect, tw, th) -> RGBA tw x th: the rect {x, y, w, h} (source pixels, may be
 * fractional) of the RGBA source, scaled. Colour is weighted by alpha, so transparent pixels don't
 * darken the edges of what is opaque (as a canvas draws them).
 */
export function resample(data, w, h, rect, tw, th) {
  const r = rect || { x: 0, y: 0, w, h };
  const X = weights(r.x, r.w, w, tw), Y = weights(r.y, r.h, h, th);
  const mid = new Float32Array(tw * h * 4);         // horizontal pass, premultiplied
  for (let y = 0; y < h; y++) {
    for (let o = 0; o < tw; o++) {
      let R = 0, G = 0, Bl = 0, A = 0;
      const is = X.idx[o], ws = X.wts[o];
      for (let k = 0; k < is.length; k++) {
        const s = (y * w + is[k]) * 4, a = data[s + 3] * ws[k];
        R += data[s] * a; G += data[s + 1] * a; Bl += data[s + 2] * a; A += a;
      }
      const d = (y * tw + o) * 4;
      mid[d] = R; mid[d + 1] = G; mid[d + 2] = Bl; mid[d + 3] = A;
    }
  }
  const out = new Uint8Array(tw * th * 4);
  for (let o = 0; o < th; o++) {
    const is = Y.idx[o], ws = Y.wts[o];
    for (let x = 0; x < tw; x++) {
      let R = 0, G = 0, Bl = 0, A = 0;
      for (let k = 0; k < is.length; k++) {
        const s = (is[k] * tw + x) * 4, v = ws[k];
        R += mid[s] * v; G += mid[s + 1] * v; Bl += mid[s + 2] * v; A += mid[s + 3] * v;
      }
      const d = (o * tw + x) * 4;
      if (A > 0) { out[d] = clamp(Math.round(R / A), 0, 255); out[d + 1] = clamp(Math.round(G / A), 0, 255); out[d + 2] = clamp(Math.round(Bl / A), 0, 255); }
      out[d + 3] = clamp(Math.round(A), 0, 255);
    }
  }
  return out;
}

// ------------------------------------------------------------------ the app's measures

/**
 * analyse({w, h, data}) -> {colours, crop, texture, w, h}: what FiveSBring.process gives for the
 * same picture, step for step (bring.js processNow 1–3), with the app's own measuring functions.
 * w and h are the size the app would keep it at (at most 720 px on the long edge).
 */
export function analyse(img) {
  const [w, h] = fit(img.w, img.h, MAX_EDGE);
  const work = w === img.w && h === img.h ? img.data : resample(img.data, img.w, img.h, null, w, h);
  // 2. colours, on a 96 px copy
  const [cw, ch] = fit(w, h, COLOUR_EDGE);
  const colours = B.dominantColours(resample(work, w, h, null, cw, ch));
  // 3. the surface: search a copy 128 px on its shorter edge, measure at 512 from the original
  const as = Math.min(1, ANALYSIS_SHORT / Math.min(w, h));
  const aw = Math.max(1, Math.round(w * as)), ah = Math.max(1, Math.round(h * as));
  const an = aw === w && ah === h ? work : resample(work, w, h, null, aw, ah);
  const win = B.findSurface(an, aw, ah);
  let cx, cy, cs;
  if (win) { cx = win.x / aw; cy = win.y / ah; cs = win.s; } else {
    cs = Math.max(1, Math.round(Math.min(aw, ah) / 4));
    cx = (aw - cs) / 2 / aw; cy = (ah - cs) / 2 / ah;
  }
  const fw = round(cs / aw, 4), fh = round(cs / ah, 4);
  const crop = [round(clamp(cx, 0, 1 - fw), 4), round(clamp(cy, 0, 1 - fh), 4), fw, fh];
  const tex = resample(img.data, img.w, img.h, { x: crop[0] * img.w, y: crop[1] * img.h, w: crop[2] * img.w, h: crop[3] * img.h }, TEX_SIDE, TEX_SIDE);
  const texture = B.textureScale(B.edgeDensity(tex, TEX_SIDE, TEX_SIDE));
  return { colours, crop, texture, w, h };
}

// ------------------------------------------------------------------ small pictures for the app

/** JPEG bytes for RGBA pixels (flattened on white: JPEG has no transparency). */
export function encodeJpeg(img, quality) {
  const d = new Uint8Array(img.data.length);
  for (let i = 0; i < d.length; i += 4) {
    const a = img.data[i + 3] / 255;
    d[i] = Math.round(img.data[i] * a + 255 * (1 - a));
    d[i + 1] = Math.round(img.data[i + 1] * a + 255 * (1 - a));
    d[i + 2] = Math.round(img.data[i + 2] * a + 255 * (1 - a));
    d[i + 3] = 255;
  }
  const out = jpeg.encode({ width: img.w, height: img.h, data: d }, quality).data;
  return out instanceof Uint8Array ? new Uint8Array(out.buffer, out.byteOffset, out.length) : Uint8Array.from(out);
}

/** A data: URL of bytes (base64), for a picture of a known type. */
export function dataUrl(bytes, mime) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  return 'data:' + mime + ';base64,' + btoa(s);
}

/** Make a picture small enough for the app: at most 720 px, as JPEG, under `cap` bytes. */
export function shrink(img, cap) {
  let [w, h] = fit(img.w, img.h, MAX_EDGE);
  for (let tries = 0; tries < 6; tries++) {
    const small = w === img.w && h === img.h ? img : { w, h, data: resample(img.data, img.w, img.h, null, w, h) };
    for (const q of [82, 70, 58]) {
      const bytes = encodeJpeg(small, q);
      if (bytes.length <= cap) return { bytes, w, h };
    }
    [w, h] = fit(w, h, Math.max(160, Math.round(Math.max(w, h) * 0.75)));
    if (Math.max(w, h) <= 160 && tries > 0) break;
  }
  return null;
}
