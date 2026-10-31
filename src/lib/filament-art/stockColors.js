import { hexLinear, lab, deltaE00 } from './colorSpaces.js';

export function availableColors(rows) {
  return rows.filter(row => row.in_stock === true && row.profile?.material === 'PLA' && row.profile?.effect !== 'multicolor' && /^#[0-9a-f]{6}$/i.test(row.profile?.hex)).map(row => ({id:row.id,name:row.profile.name,hex:row.profile.hex.toLowerCase()}));
}
export function matchStockColor(hex, colors) {
  const original = lab(hexLinear(hex));
  const ranked = colors.map(color => ({...color,difference:deltaE00(original,lab(hexLinear(color.hex)))})).sort((a,b) => a.difference-b.difference);
  return { suggested:ranked[0], compatible:!!ranked.length && ranked[0].difference <= 8 };
}

export function validateStockSelection(input, rows) {
  if (!Array.isArray(input.filamentIds) || input.filamentIds.length !== input.palette.length) throw new Error('Selecione um filamento para cada cor.');
  const stock = availableColors(rows);
  if (input.filamentIds.some((id,i)=>!stock.some(color=>color.id===id && color.hex===input.palette[i].toLowerCase()))) throw new Error('O estoque de cores mudou. Atualize os filamentos e escolha uma cor disponível.');
}
