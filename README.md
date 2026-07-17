# I.J Print 26 — Catálogo 3D

Catálogo interativo para venda de produtos de impressão 3D (Miniaturas, Personalizados, Casa e Decoração, Sensoriais, Hot Toys). O site permite visualizar os produtos, ver detalhes, adicionar a um carrinho de compras e enviar o pedido estruturado diretamente via WhatsApp.

##  Tecnologias Utilizadas

- **React** + **Vite**
- **Tailwind CSS** (estilização com paleta personalizada `silver` e `sand`)
- **Lucide React** (ícones)
- **React Router Dom** (navegação)
- Context API (gerenciamento global do carrinho)

##  Como rodar o projeto localmente

1. Certifique-se de ter o [Node.js](https://nodejs.org/) instalado.
2. Clone este repositório.
3. Instale as dependências executando no terminal:
   ```bash
   npm install
   ```
4. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
5. Acesse `http://localhost:5173` no seu navegador.

##  Gerenciamento de Produtos

Os produtos são gerenciados de forma estática, sem necessidade de banco de dados.
- O arquivo que controla o catálogo é o `src/data/produtos.js`.
- As imagens devem ser quadradas (1:1), preferencialmente em fundo escuro, e salvas na pasta `public/produtos/`.
- Basta adicionar um novo bloco `{ id, nome, preco, imagem, categoria, ... }` no array para que o produto apareça imediatamente no site.


Para publicar:
1. Suba este código para o seu GitHub.
2. Crie uma conta na [Vercel](https://vercel.com/).
3. Clique em "Add New Project" e conecte o seu repositório do GitHub.
4. A Vercel detectará automaticamente que é um projeto Vite. Basta clicar em **Deploy**.
5. Qualquer push na branch `main` atualizará o site automaticamente em segundos.
