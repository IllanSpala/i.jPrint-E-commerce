# Reformulação da home I.J Print

## Auditoria e escolhas

- Paleta original mantida: `sand` em `tailwind.config.js`, com principal `#D4C3A3`. Os novos CTAs usam as mesmas classes. Fontes Inter/Oswald e base zinc preservadas.
- Verde de referência `#8EA493`, amostrado do tecido da foto 56; tons escuros derivados para contraste. As sete fotos fornecidas estão em WebP, com dimensões limitadas a 1600 px.
- Entrada `/`: aviso compacto de como comprar, com três opções e botão “Prosseguir para o catálogo”.
- Loja `/catalogo`: carrossel e catálogo preservados, com seletor “Sob encomenda” / “Pronta entrega”.
- `/pedido-personalizado`: formulário separado, acessível na entrada e no catálogo.
- Pronta entrega muda o cabeçalho quando sua aba está ativa e restaura o tema ao sair. Entrada sem animações, conteúdo oculto ou blocos presos à rolagem.
- Busca, categorias, ordenação, normalização de produtos, disponibilidade administrativa e carrinho preservados.

## Peças prontas

Grade compartilhada com o catálogo, contendo Xenonita, Jax, Tony Montana e Edward Mãos de Tesoura. Tony e Edward usam enquadramentos da fotografia real do conjunto. Cada card abre a página do produto, com galeria, descrição e botão de adicionar ao carrinho. Preço provisório solicitado: R$ 20,00 por peça, editável em `src/data/prontaEntrega.js`.

Os IDs de pronta entrega são separados dos modelos sob encomenda. Preços e medidas são resolvidos no servidor por `api/_lib/catalogoCompra.js`, usado na precificação, no frete e na criação do pedido. Medidas e pesos reutilizam o cadastro dos modelos correspondentes. Não há controle de quantidade física reservada implementado nesta seleção.

## Pedido personalizado

Nome, e-mail, descrição, referência http/https e até três imagens/vídeos, totalizando 3 MiB. Prévia, remoção, validação cliente/servidor, checagem de assinatura do arquivo e limite de requisições. Vídeos maiores podem ser enviados por link. Anexos são encaminhados por e-mail para o endereço administrativo já configurado, sem armazenamento público.

Endpoint `/api/pedido-personalizado` reutiliza Supabase (limite de requisições já existente) e Resend (mailer atual). Exige `SUPABASE_URL` ou `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` e a função `limitar_requisicoes_loja` existente. Nenhuma nova migração ou dependência.

O servidor só confirma sucesso se o serviço de e-mail aceitar o envio. Usa chave idempotente para repetição sem alteração de conteúdo. O Vite isolado mostra a interface, mas não executa funções da Vercel; testar envio em ambiente com as funções configuradas.

## Verificação

- Compilação de produção concluída. Aviso de bundle grande permanece (aplicação inclui editor 3D).
- Suite existente e novos testes passam; validação de dados, anexos de 2 MiB, falha do provedor, limite de requisições e escape de texto cobertos.
- Navegador: vitrine desktop, formulário em 390 px, consulta com texto preenchido, filtro móvel de chaveiros e retorno ao tema areia verificados. Sem excesso horizontal no viewport móvel inspecionado.
- Não foram enviados e-mails reais nem publicado o site. Integração com e-mail testada com serviço simulado.

## Revisão da navegação

Apresentação removida da página de produtos. Aviso integral verificado em 390 × 844 (botão dentro da tela, sem rolagem). Rotas de catálogo e pronta entrega inspecionadas no navegador. A automação de cliques apresentou timeout, então a inspeção das rotas foi feita por navegação direta. Build aprovado.

Validação dos valores provisórios: build e 14 arquivos de testes aprovados, incluindo carrinho misto e rejeição de preço livre para peças prontas. Nenhuma cobrança real realizada.

## Ativação administrativa da pronta entrega

Aplicar uma vez `supabase/pronta_entrega_ativos.sql` no SQL Editor do Supabase. A migração cria quatro registros de estado e pode ser repetida sem reativar itens desativados. Leitura pública restrita aos estados; gravação somente pelo servidor, via endpoint protegido por autenticação e permissão de administrador.

O painel exibe as peças com identificação “Pronta entrega”. O catálogo, a página de produto e a precificação consultam esses estados. Peças sem registro, ou quando a leitura falha, não são liberadas por fallback local. Itens já no carrinho são recusados no frete/pagamento se desativados; pedidos existentes permanecem inalterados.

Migração não aplicada nesta sessão: o ambiente local contém apenas as configurações públicas do frontend, sem acesso administrativo ao banco. Até aplicar a migração, a pronta entrega informa indisponibilidade. Compilação e 14 arquivos de testes passaram, incluindo desativação, reativação, ausência de estado e falha do banco.

## Correção de carregamento e preços atuais

A leitura real do Supabase confirmou PGRST205: a tabela de estados ainda não foi criada. Nesse caso específico o catálogo usa as peças locais e o admin informa a migração pendente, com os botões dessas peças desabilitados. Erros de rede/permissão e registros ausentes em uma tabela existente continuam fechando a disponibilidade. Após a migração, os estados administrativos são usados automaticamente.

Valores definidos pelo proprietário: Xenonita R$ 189,90; Jax R$ 21,90; Tony Montana R$ 63,90; Edward R$ 63,90. Carrinhos persistidos atualizam os preços das peças prontas ao abrir o aplicativo, preservando quantidade e demais produtos. Isso substitui as observações anteriores sobre preços provisórios e bloqueio total antes da migração.
