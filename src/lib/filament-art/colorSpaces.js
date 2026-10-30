export const linearizar = v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
export const codificar = v => Math.max(0, Math.min(1, v <= .0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - .055));
export function hexLinear(hex) {
  if (!/^#[\da-f]{6}$/i.test(hex)) throw new Error('Cor de filamento inválida.');
  return [1, 3, 5].map(i => linearizar(parseInt(hex.slice(i, i + 2), 16) / 255));
}
export function lab(rgb) {
  const [r, g, b] = rgb;
  const f = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
  const x = f((.4124564 * r + .3575761 * g + .1804375 * b) / .95047);
  const y = f(.2126729 * r + .7151522 * g + .072175 * b);
  const z = f((.0193339 * r + .119192 * g + .9503041 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
// CIEDE2000, kL=kC=kH=1; angles in degrees as in the published definition.
export function deltaE00(a, b) {
  const rad = Math.PI / 180, cos = x => Math.cos(x * rad), sin = x => Math.sin(x * rad);
  const [l1, a1, b1] = a, [l2, a2, b2] = b;
  const c = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const g = .5 * (1 - Math.sqrt(c ** 7 / (c ** 7 + 25 ** 7)));
  const ap1 = (1 + g) * a1, ap2 = (1 + g) * a2;
  const c1 = Math.hypot(ap1, b1), c2 = Math.hypot(ap2, b2);
  const hue = (x, y) => (Math.atan2(y, x) / rad + 360) % 360;
  const h1 = c1 === 0 ? 0 : hue(ap1, b1), h2 = c2 === 0 ? 0 : hue(ap2, b2);
  let dh = h2 - h1;
  if (c1 * c2 === 0) dh = 0;
  else if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const dl = l2 - l1, dc = c2 - c1, dH = 2 * Math.sqrt(c1 * c2) * sin(dh / 2);
  const lm = (l1 + l2) / 2, cm = (c1 + c2) / 2;
  const hm = c1 * c2 === 0 ? h1 + h2 : Math.abs(h1 - h2) <= 180 ? (h1 + h2) / 2 : (h1 + h2 + (h1 + h2 < 360 ? 360 : -360)) / 2;
  const t = 1 - .17 * cos(hm - 30) + .24 * cos(2 * hm) + .32 * cos(3 * hm + 6) - .20 * cos(4 * hm - 63);
  const sl = 1 + .015 * (lm - 50) ** 2 / Math.sqrt(20 + (lm - 50) ** 2);
  const sc = 1 + .045 * cm, sh = 1 + .015 * cm * t;
  const rt = -2 * Math.sqrt(cm ** 7 / (cm ** 7 + 25 ** 7)) * sin(60 * Math.exp(-(((hm - 275) / 25) ** 2)));
  return Math.sqrt(Math.max(0, (dl / sl) ** 2 + (dc / sc) ** 2 + (dH / sh) ** 2 + rt * dc / sc * dH / sh));
}
