import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { produtos } from '../src/data/produtos.js';
import { prontaEntrega } from '../src/data/prontaEntrega.js';
const ausentes = [];
for (const produto of [...produtos, ...prontaEntrega]) {
  for (const caminho of new Set([produto.imagem, ...(produto.imagens || [])])) {
    if (!caminho?.startsWith('/') || caminho.startsWith('//')) continue;
    if (!existsSync(fileURLToPath(new URL(`../public${caminho}`, import.meta.url)))) {
      ausentes.push(`${produto.id} (${produto.nome}): ${caminho}`);
    }
  }
}
if (ausentes.length) {
  console.error('Imagens ausentes no catálogo:\n' + ausentes.join('\n'));
  process.exitCode = 1;
} else console.log('Imagens locais do catálogo verificadas.');
