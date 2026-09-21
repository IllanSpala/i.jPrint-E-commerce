// Aceita somente geometria SVG estática. Referências externas, CSS, eventos,
// entidades/DTD e elementos ativos são recusados inclusive nos anexos originais.
const tags = new Set(['svg','g','path','rect','circle','ellipse','line','polyline','polygon','text','tspan','defs','clipPath','mask','linearGradient','radialGradient','stop','title','desc']);
const atributos = new Set('xmlns viewBox width height x y x1 y1 x2 y2 cx cy r rx ry d points transform fill fill-rule fill-opacity stroke stroke-width stroke-linecap stroke-linejoin stroke-opacity opacity id clip-path mask offset stop-color stop-opacity gradientUnits gradientTransform spreadMethod font-family font-size font-weight text-anchor dominant-baseline preserveAspectRatio version'.split(' '));
export function svgSeguro(svg) {
  if (typeof svg !== 'string' || svg.length > 500000 || /<!|<\?|&|\u0000/.test(svg)) return false;
  const pilha = [];
  let cursor = 0, raiz = false;
  const tokens = /<([^<>]*)>/g;
  for (const token of svg.matchAll(tokens)) {
    if (svg.slice(cursor, token.index).includes('<')) return false;
    if (!pilha.length && svg.slice(cursor, token.index).trim()) return false;
    cursor = token.index + token[0].length;
    const match = /^(\/)?([A-Za-z]+)([\s\S]*?)(\/)?$/.exec(token[1]);
    if (!match || !tags.has(match[2])) return false;
    const [, fecha, tag, resto, autoFecha] = match;
    if (fecha) { if (resto.trim() || autoFecha || pilha.pop() !== tag) return false; continue; }
    if (!pilha.length) { if (raiz || tag !== 'svg') return false; raiz = true; }
    const attrs = /\s+([\w:-]+)\s*=\s*("[^"]*"|'[^']*')/g;
    let fim = 0; const vistos = new Set();
    for (const attr of resto.matchAll(attrs)) {
      if (resto.slice(fim, attr.index).trim() || !atributos.has(attr[1]) || vistos.has(attr[1])) return false;
      vistos.add(attr[1]); fim = attr.index + attr[0].length;
      const valor = attr[2].slice(1, -1);
      if (/[<>\\]/.test(valor)) return false;
      if (attr[1] === 'xmlns') { if (valor !== 'http://www.w3.org/2000/svg') return false; }
      else if (/:|@|\/\*|expression/i.test(valor) || (/url\s*\(/i.test(valor) && !/^url\(#[A-Za-z0-9_-]+\)$/.test(valor))) return false;
    }
    if (resto.slice(fim).trim()) return false;
    if (!autoFecha) pilha.push(tag);
  }
  return raiz && pilha.length === 0 && !svg.slice(cursor).trim();
}
