import test from 'node:test';
import assert from 'node:assert/strict';
import { validarAnexosPedido, LIMITE_BYTES_ANEXOS_PEDIDO } from '../src/lib/anexosPedido.js';
import { validarAnexosItem } from '../api/_lib/validarPersonalizacao.js';

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const anexoPng = { nome: 'foto.png', tipo: 'image/png', tamanho: png.length, dados: `data:image/png;base64,${png.toString('base64')}` };

test('valida seleção de fotos e vídeos do produto', () => {
  assert.equal(validarAnexosPedido([{ type: 'image/png', size: 10 }]), '');
  assert.ok(validarAnexosPedido([{ type: 'application/pdf', size: 10 }]));
  assert.ok(validarAnexosPedido([{ type: 'image/png', size: LIMITE_BYTES_ANEXOS_PEDIDO + 1 }]));
});

test('servidor confere mime, base64 e assinatura dos anexos', () => {
  assert.equal(validarAnexosItem([anexoPng]), null);
  assert.ok(validarAnexosItem([{ ...anexoPng, tipo: 'image/jpeg' }]));
  assert.ok(validarAnexosItem([{ ...anexoPng, dados: 'data:image/png;base64,PGh0bWw+' }]));
});
