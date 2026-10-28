// png.js - a screenshot's pixels in Node (zlib only): decode(buffer) -> { width, height, data: RGBA bytes }, and the
// mean difference of two screenshots over a box (CSS px, k device px to a CSS px). Playwright's PNGs are 8-bit RGB or
// RGBA, not interlaced: those are what this reads.
const zlib = require("zlib");
function decode(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) { throw new Error("not a PNG"); }
  let off = 8, width = 0, height = 0, type = 0, depth = 0, interlace = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), kind = buf.toString("ascii", off + 4, off + 8), body = buf.subarray(off + 8, off + 8 + len);
    if (kind === "IHDR") { width = body.readUInt32BE(0); height = body.readUInt32BE(4); depth = body[8]; type = body[9]; interlace = body[12]; }
    else if (kind === "IDAT") { idat.push(body); }
    else if (kind === "IEND") { break; }
    off += 12 + len;
  }
  if (depth !== 8 || interlace || (type !== 2 && type !== 6)) { throw new Error("PNG kind not read here: depth " + depth + ", type " + type + ", interlace " + interlace); }
  const bpp = type === 6 ? 4 : 3, stride = width * bpp, raw = zlib.inflateSync(Buffer.concat(idat)), out = Buffer.alloc(width * height * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (f === 1) { v += a; } else if (f === 2) { v += b; } else if (f === 3) { v += (a + b) >> 1; }
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      line[x] = v & 255;
    }
    for (let x = 0; x < width; x++) { const o = (y * width + x) * 4; out[o] = line[x * bpp]; out[o + 1] = line[x * bpp + 1]; out[o + 2] = line[x * bpp + 2]; out[o + 3] = bpp === 4 ? line[x * bpp + 3] : 255; }
    prev = line;
  }
  return { width, height, data: out };
}
// The mean absolute difference per channel of two screenshots over a square of half side r round (x, y), CSS px.
function boxDiff(a, b, x, y, r, k) {
  let s = 0, n = 0;
  for (let j = Math.max(0, Math.round((y - r) * k)); j < Math.min(a.height, (y + r) * k); j++) {
    for (let i = Math.max(0, Math.round((x - r) * k)); i < Math.min(a.width, (x + r) * k); i++) {
      const o = (j * a.width + i) * 4;
      for (let c = 0; c < 3; c++) { s += Math.abs(a.data[o + c] - b.data[o + c]); }
      n += 3;
    }
  }
  return s / Math.max(1, n);
}
module.exports = { decode, boxDiff };
