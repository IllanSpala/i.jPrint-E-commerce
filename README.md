# I.J Print 26 — Catálogo 3D

Catálogo interativo para venda de produtos de impressão 3D (Miniaturas, Personalizados, Casa e Decoração, Sensoriais, Hot Toys). O site permite visualizar os produtos, ver detalhes, adicionar a um carrinho de compras e enviar o pedido estruturado diretamente via WhatsApp.

##  Tecnologias Utilizadas

- **React** + **Vite**
- **Tailwind CSS** (estilização com paleta personalizada `silver` e `sand`)
- **Lucide React** (ícones)
- **React Router Dom** (navegação)
- Context API (gerenciamento global do carrinho)

##  Gerenciamento de Produtos

Os produtos são gerenciados de forma estática, sem necessidade de banco de dados.
- O arquivo que controla o catálogo é o `src/data/produtos.js`.
- As imagens devem ser quadradas (1:1), preferencialmente em fundo escuro, e salvas na pasta `public/produtos/`.
- Basta adicionar um novo bloco `{ id, nome, preco, imagem, categoria, ... }` no array para que o produto apareça imediatamente no site.


