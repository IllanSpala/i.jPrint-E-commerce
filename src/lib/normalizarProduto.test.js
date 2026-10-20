import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { normalizarProduto } from "./normalizarProduto.js";

for (const id of [70, 74, 75, 76]) {
  test(`produto ${id} mantém o pipeline 3D com dados do banco`, () => {
    for (const personalizador3d of [undefined, null, false]) {
      const produto = normalizarProduto({
        id: String(id), preco: 89, personalizador3d, modelo3d: null,
        aplicacaoSvg: null, categorias: null, exige_personalizacao: false,
      });
      assert.equal(produto.personalizador3d, true);
      assert.equal(produto.exigePersonalizacao, false);
      assert.equal(produto.preco, 89);
      assert.ok(existsSync(`public${produto.modelo3d}`));
      assert.ok(produto.categorias.includes("Personalizados"));
      if (id === 74 || id === 75) assert.equal(produto.aplicacaoSvg.tipo, "fundo");
      if (id === 76) assert.equal(produto.aplicacaoSvg.tipo, "corpo");
    }
  });
}

test("produto comum continua sem editor 3D", () => {
  assert.notEqual(normalizarProduto({ id: 69 }).personalizador3d, true);
});

test('classificação paramétrica é metadado e não uma categoria de navegação', () => {
  const produto = normalizarProduto({id:74});
  assert.equal(produto.parametrico, true);
  assert.ok(produto.classificacoesInternas.includes('Paramétricos'));
  assert.ok(!produto.categorias.includes('Paramétricos'));
  const comum = normalizarProduto({id:69});
  assert.equal(comum.parametrico, false);
  assert.ok(!comum.classificacoesInternas.includes('Paramétricos'));
});
