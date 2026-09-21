import { limitarRequisicoes } from './_lib/seguranca.js';
import { createHash, randomUUID } from 'node:crypto';
import { hashCarrinho, verificarCotacao } from './_lib/freteSeguro.js';
import { bancoServidor, cpfValido } from './_lib/seguranca.js';
import {
  obterCupom,
  verificarPrimeiraCompra,
  precificarItens,
  calcularDesconto,
  reservarCupom
} from './_lib/cupons.js';
import { validarPersonalizacao } from './_lib/validarPersonalizacao.js';

export function criarHandlerPagamento(
  supabase,
  {
    fetchPagamento = fetch,
  } = {}
) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({
        error: 'Método não permitido'
      });
    }

    const {
      endereco,
      itens,
      cupom: codigoCupom,
      modo_entrega,
      cotacao
    } = req.body || {};

    let frete_valor = 0;
    let freteServico = null;

    if (
      !endereco ||
      !['envio', 'retirada', 'digital'].includes(modo_entrega)
    ) {
      return res.status(400).json({
        error: 'Selecione a forma de entrega.'
      });
    }

    if (!Array.isArray(itens) || !itens.length) {
      return res.status(400).json({
        error: 'Carrinho vazio ou inválido.'
      });
    }

    if (
      Buffer.byteLength(JSON.stringify(req.body), 'utf8') >
      3500000
    ) {
      return res.status(413).json({
        error:
          'Os arquivos do pedido estão muito grandes. Reduza o tamanho dos SVGs ou divida a compra em pedidos menores.'
      });
    }

    for (const item of itens) {
      const erroPersonalizacao =
        validarPersonalizacao(item);

      if (erroPersonalizacao) {
        return res.status(400).json({
          error: erroPersonalizacao
        });
      }
    }

    const authHeader =
      req.headers.authorization;

    if (
      !authHeader ||
      !authHeader.startsWith('Bearer ')
    ) {
      return res.status(401).json({
        error:
          'Acesso negado: Token de autenticação ausente'
      });
    }

    const token =
      authHeader.split(' ')[1];

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({
        error:
          'Acesso negado: Token inválido ou expirado'
      });
    }

    const {
      data: perfilDb
    } = await supabase
      .from('perfis')
      .select('nome,cpf,telefone')
      .eq('id', user.id)
      .single();

    if (
      !perfilDb?.cpf ||
      !/^\d{10,11}$/.test(
        String(
          perfilDb.telefone || ''
        ).replace(/\D/g, '')
      ) ||
      !cpfValido(perfilDb.cpf)
    ) {
      return res.status(400).json({
        error:
          'Complete CPF e telefone no perfil.'
      });
    }

    const clienteNome =
      perfilDb?.nome ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email.split('@')[0];

    const clienteEmail =
      user.email;

    const handle =
      process.env.INFINITEPAY_HANDLE;

    if (!handle) {
      return res.status(503).json({
        error:
          'Pagamento indisponível: configuração pendente.'
      });
    }

    const pedido_id =
      randomUUID();

    let cupom = null;
    let desconto = null;
    let cupomReservado = false;
    let linkPodeExistir = false;
    let pedidoCriado = false;

    try {
      await limitarRequisicoes(
        supabase,
        `pagamento:${user.id}`,
        10
      );

      if (codigoCupom) {
        cupom =
          obterCupom(codigoCupom);
      }

      const itensSeguros =
        await precificarItens(
          supabase,
          itens
        );

      if (modo_entrega === 'envio') {
        const frete =
          verificarCotacao(cotacao, {
            userId: user.id,

            cep: String(
              endereco.cep || ''
            ).replace(/\D/g, ''),

            carrinho:
              hashCarrinho(
                itens,
                itensSeguros
              )
          });

        frete_valor =
          frete.centavos / 100;

        freteServico =
          frete.servico;

        const camposEndereco = [
          endereco.logradouro ||
          endereco.rua,
          endereco.numero,
          endereco.bairro,
          endereco.cidade,
          endereco.uf
        ];

        const enderecoValido =
          camposEndereco.every(
            (valor) =>
              typeof valor === 'string' &&
              valor.trim().length > 0 &&
              valor.length <= 200
          );

        if (!enderecoValido) {
          throw Object.assign(
            new Error(
              'Endereço incompleto.'
            ),
            {
              status: 400
            }
          );
        }
      }

      if (
        modo_entrega === 'digital' &&
        !itens.every(
          (item) => item.id === 0
        )
      ) {
        throw Object.assign(
          new Error(
            'Entrega inválida.'
          ),
          {
            status: 400
          }
        );
      }

      let items_payload =
        [...itensSeguros];

      if (cupom) {
        desconto =
          calcularDesconto(
            itensSeguros,
            cupom
          );

        items_payload =
          desconto.itemsComDesconto;
      }

      if (frete_valor > 0) {
        items_payload.push({
          quantity: 1,

          price:
            Math.round(
              frete_valor * 100
            ),

          description:
            'Frete / Entrega'
        });
      }

      const siteUrl_infinite =
        process.env.SITE_URL ||
        'https://www.ijprint26.com';

      let siteUrl;

      try {
        siteUrl =
          new URL(
            siteUrl_infinite
          );
      } catch {
        throw new Error(
          'Configure SITE_URL com uma URL válida.'
        );
      }

      if (
        siteUrl.protocol !== 'https:'
      ) {
        throw new Error(
          'Configure SITE_URL com HTTPS.'
        );
      }

      const webhookUrl_infinite =
        `${siteUrl_infinite}/api/webhook`;

      const body = {
        handle,

        order_nsu:
          pedido_id.toString(),

        redirect_url:
          `${siteUrl_infinite}/pedido-confirmado?pedido_id=${pedido_id}`,

        webhook_url:
          webhookUrl_infinite,

        customer: {
          name: clienteNome,
          email: clienteEmail
        },

        items:
          items_payload
      };

      const totalCentavos =
        items_payload.reduce(
          (total, item) =>
            total +
            item.price *
            item.quantity,
          0
        );

      if (
        !Number.isSafeInteger(
          totalCentavos
        ) ||
        totalCentavos < 1
      ) {
        throw Object.assign(
          new Error(
            'Total inválido.'
          ),
          {
            status: 400
          }
        );
      }

      const valorTotalSeguro =
        totalCentavos / 100;

      const {
        data: catalogo,
        error: erroCatalogo
      } = await supabase
        .from('produtos')
        .select('*')
        .in(
          'id',
          itens.map(
            (item) => item.id
          )
        );

      if (
        erroCatalogo ||
        !catalogo
      ) {
        throw new Error(
          'Catálogo indisponível.'
        );
      }

      const itensCanonicos =
        itens.map(
          (item, index) => {
            const produto =
              catalogo.find(
                (produtoCatalogo) =>
                  produtoCatalogo.id ===
                  item.id
              );

            if (!produto) {
              throw Object.assign(
                new Error(
                  'Produto não encontrado no catálogo.'
                ),
                {
                  status: 400
                }
              );
            }

            return {
              id:
                item.id,

              nome:
                itensSeguros[index]
                  .description,

              preco:
                itensSeguros[index]
                  .price / 100,

              quantidade:
                item.quantidade,

              opcaoEscolhida:
                item.opcaoEscolhida ||
                null,

              modoCompra:
                item.modoCompra ||
                null,

              personalizacao:
                typeof item.personalizacao ===
                  'string'
                  ? item.personalizacao.slice(
                    0,
                    5000
                  )
                  : null,

              parametrosMultiplos:
                Array.isArray(
                  item.parametrosMultiplos
                )
                  ? item.parametrosMultiplos.map(
                    (valor) =>
                      String(
                        valor
                      ).slice(
                        0,
                        500
                      )
                  )
                  : null,

              personalizacoes:
                item.personalizacoes ||
                null,

              dimensoes:
                produto.dimensoes,

              peso_gramas:
                produto.peso_gramas
            };
          }
        );

      const enderecoCanonico =
        modo_entrega === 'envio'
          ? Object.fromEntries(
            [
              'logradouro',
              'rua',
              'numero',
              'bairro',
              'cidade',
              'uf',
              'cep',
              'complemento'
            ].map(
              (campo) => [
                campo,
                String(
                  endereco[campo] ||
                  ''
                ).slice(
                  0,
                  200
                )
              ]
            )
          )
          : {
            logradouro:
              modo_entrega ===
                'retirada'
                ? 'Quadra da Guararema'
                : 'Pagamento Online',

            cidade:
              'Alegre',

            uf:
              'ES',

            cep:
              '-'
          };

      const checkout_hash =
        createHash('sha256')
          .update(
            JSON.stringify({
              user:
                user.id,

              itens:
                itensCanonicos,

              endereco:
                enderecoCanonico,

              frete_valor,

              freteServico,

              modo_entrega,

              cupom:
                cupom?.codigo
            })
          )
          .digest('hex');

      const novoPedido = {
        id:
          pedido_id,

        user_id:
          user.id,

        endereco: {
          ...enderecoCanonico,

          cliente_nome:
            clienteNome,

          cliente_email:
            clienteEmail
        },

        itens:
          itensCanonicos,

        frete_valor,

        frete_servico:
          freteServico,

        modo_entrega,

        pagamento_handle:
          handle,

        checkout_hash,

        total:
          valorTotalSeguro,

        status:
          'Aguardando Pagamento',

        ...(cupom
          ? {
            cupom_codigo:
              cupom.codigo,

            desconto:
              desconto
                .descontoCentavos /
              100
          }
          : {})
      };

      const existente =
        await supabase
          .from('pedidos')
          .select(
            'id,link_pagamento'
          )
          .eq(
            'user_id',
            user.id
          )
          .eq(
            'checkout_hash',
            checkout_hash
          )
          .eq(
            'status',
            'Aguardando Pagamento'
          )
          .maybeSingle();

      if (existente.error) {
        throw new Error(
          'Não foi possível verificar pagamentos pendentes.'
        );
      }

      if (existente.data) {
        if (
          existente.data
            .link_pagamento
        ) {
          return res
            .status(200)
            .json({
              pedido_id:
                existente.data.id,

              link_pagamento:
                existente.data
                  .link_pagamento,

              status:
                'pending'
            });
        }

        return res
          .status(409)
          .json({
            error:
              'Pedido em processamento. Aguarde a conciliação antes de pagar novamente.'
          });
      }

      if (cupom) {
        await verificarPrimeiraCompra(
          supabase,
          user.id
        );
      }

      const {
        error: insertError
      } = await supabase
        .from('pedidos')
        .insert(
          novoPedido
        );

      if (insertError) {
        if (
          insertError.code ===
          '23505'
        ) {
          const {
            data: anterior
          } = await supabase
            .from('pedidos')
            .select(
              'id,link_pagamento'
            )
            .eq(
              'user_id',
              user.id
            )
            .eq(
              'checkout_hash',
              checkout_hash
            )
            .eq(
              'status',
              'Aguardando Pagamento'
            )
            .maybeSingle();

          if (
            anterior
              ?.link_pagamento
          ) {
            return res
              .status(200)
              .json({
                pedido_id:
                  anterior.id,

                link_pagamento:
                  anterior
                    .link_pagamento,

                status:
                  'pending'
              });
          }

          return res
            .status(409)
            .json({
              error:
                'Pagamento já está em processamento. Aguarde a conciliação antes de tentar novamente.'
            });
        }

        throw new Error(
          'Erro ao salvar pedido. Nenhuma cobrança foi criada.'
        );
      }

      pedidoCriado = true;

      if (cupom) {
        await reservarCupom(
          supabase,
          user.id,
          pedido_id,
          cupom.codigo
        );

        cupomReservado =
          true;
      }

      /*
       * A partir daqui uma cobrança pode ter sido criada
       * mesmo se houver falha ou timeout na comunicação.
       */
      linkPodeExistir =
        true;

      const response =
        await fetchPagamento(
          'https://api.checkout.infinitepay.io/links',
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json'
            },

            body:
              JSON.stringify(
                body
              ),

            signal:
              AbortSignal.timeout(
                10000
              )
          }
        );

      const contentType =
        response.headers
          ?.get?.(
            'content-type'
          ) || null;

      console.log(
        '[Pagamento] InfinitePay HTTP:',
        {
          status:
            response.status,

          ok:
            response.ok,

          contentType
        }
      );

      if (!response.ok) {
        if (
          response.status >=
          400 &&
          response.status <
          500 &&
          response.status !==
          408
        ) {
          linkPodeExistir =
            false;
        }

        let mensagemOperadora =
          null;

        try {
          const erroBody =
            await response.json();

          if (
            typeof erroBody
              ?.message ===
            'string'
          ) {
            mensagemOperadora =
              erroBody.message.slice(
                0,
                300
              );
          } else if (
            typeof erroBody
              ?.error ===
            'string'
          ) {
            mensagemOperadora =
              erroBody.error.slice(
                0,
                300
              );
          }
        } catch {
          // Resposta pode não ser JSON.
        }

        console.error(
          '[Pagamento] InfinitePay recusou criação:',
          {
            status:
              response.status,

            mensagem:
              mensagemOperadora
          }
        );

        throw new Error(
          'A operadora não aceitou a criação do pagamento.'
        );
      }

      let data;

      try {
        data =
          await response.json();
      } catch {
        console.error(
          '[Pagamento] InfinitePay retornou sucesso, mas o corpo não é JSON válido.',
          {
            status:
              response.status,

            contentType
          }
        );

        throw new Error(
          'Resposta inválida da operadora.'
        );
      }

      const camposResposta =
        data &&
          typeof data ===
          'object' &&
          !Array.isArray(data)
          ? Object.keys(data)
          : [];

      console.log(
        '[Pagamento] InfinitePay JSON:',
        {
          tipo:
            Array.isArray(data)
              ? 'array'
              : typeof data,

          campos:
            camposResposta,

          urlTipo:
            typeof data?.url
        }
      );

      const linkBruto =
        typeof data?.url ===
          'string'
          ? data.url.trim()
          : '';

      if (!linkBruto) {
        console.error(
          '[Pagamento] InfinitePay não retornou campo url válido.',
          {
            campos:
              camposResposta
          }
        );

        throw new Error(
          'Resposta inválida da operadora.'
        );
      }

      let urlPagamento;

      try {
        urlPagamento =
          new URL(
            linkBruto
          );
      } catch {
        console.error(
          '[Pagamento] InfinitePay retornou URL malformada.'
        );

        throw new Error(
          'Resposta inválida da operadora.'
        );
      }

      console.log(
        '[Pagamento] InfinitePay URL:',
        {
          protocol:
            urlPagamento.protocol,

          hostname:
            urlPagamento.hostname
        }
      );

      /*
       * A produção real da InfinitePay retornou
       * checkout.infinitepay.io.
       *
       * A documentação também apresenta
       * checkout.infinitepay.com.br.
       *
       * Mantemos uma allowlist exata, sem wildcard.
       */
      const hostsCheckoutInfinitePay =
        new Set([
          'checkout.infinitepay.io',
          'checkout.infinitepay.com.br'
        ]);

      if (
        urlPagamento.protocol !==
        'https:' ||
        !hostsCheckoutInfinitePay.has(
          urlPagamento.hostname
        )
      ) {
        console.error(
          '[Pagamento] Host de checkout inesperado:',
          {
            protocol:
              urlPagamento.protocol,

            hostname:
              urlPagamento.hostname
          }
        );

        throw new Error(
          'Resposta inválida da operadora.'
        );
      }

      const link_pagamento =
        urlPagamento.toString();

      const salvo =
        await supabase
          .from('pedidos')
          .update({
            link_pagamento,

            checkout_estado:
              'pronto'
          })
          .eq(
            'id',
            pedido_id
          );

      if (salvo.error) {
        throw new Error(
          'Link criado, mas aguardando conciliação. Não inicie outro pagamento.'
        );
      }

      return res
        .status(200)
        .json({
          pedido_id,

          link_pagamento,

          status:
            'pending'
        });
    } catch (error) {
      /*
       * Nunca apaga o pedido.
       * Só libera outra tentativa quando sabemos
       * que nenhum link pagável pode existir.
       */
      if (
        pedidoCriado &&
        !linkPodeExistir
      ) {
        const {
          error: falhaAtualizacao
        } = await supabase
          .from('pedidos')
          .update({
            checkout_hash:
              null,

            checkout_estado:
              'falhou'
          })
          .eq(
            'id',
            pedido_id
          )
          .eq(
            'status',
            'Aguardando Pagamento'
          );

        if (
          falhaAtualizacao
        ) {
          console.error(
            '[Pagamento] Falha ao registrar checkout como falho:',
            falhaAtualizacao.message
          );
        }
      }

      if (
        cupomReservado &&
        !linkPodeExistir
      ) {
        const {
          error: releaseError
        } = await supabase
          .from(
            'cupons_reservados'
          )
          .delete()
          .eq(
            'pedido_id',
            pedido_id
          );

        if (releaseError) {
          console.error(
            '[Cupom] Falha ao liberar reserva:',
            releaseError.message
          );
        }
      }

      console.error(
        '[Pagamento] Falha ao criar cobrança:',
        error?.message ||
        error
      );

      return res
        .status(
          error?.status ||
          500
        )
        .json({
          error:
            error?.message ||
            'Erro ao gerar cobrança'
        });
    }
  };
}

export default async function handler(
  req,
  res
) {
  try {
    return await criarHandlerPagamento(
      bancoServidor()
    )(req, res);
  } catch (error) {
    console.error(
      '[Pagamento] Falha ao inicializar handler:',
      error?.message ||
      error
    );

    return res
      .status(503)
      .json({
        error:
          'Pagamento indisponível.'
      });
  }
}