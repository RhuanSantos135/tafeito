# Tá Feito

Sistema web multi-mercearia para controle de estoque, vendas (PDV), fiado e vencimentos — sem emissão de cupom fiscal.

- **Stack:** Next.js 16 (App Router) + TypeScript + Tailwind 4, Drizzle ORM
- **Hospedagem:** Cloudflare Workers (via `@opennextjs/cloudflare`) + banco **D1**
- **Multi-tenant:** cada mercearia (tenant) tem seus usuários, dados isolados e visual próprio (fundo, logo e cores — padrão "Tá Feito" quando não personalizado)

## Rodando localmente

```bash
npm install
cp .env.seed.example .env.seed   # preencha o e-mail e a senha do super admin
npm run db:setup   # cria o banco D1 local (.wrangler/state) e popula com dados de demonstração
npm run dev        # http://localhost:3000
```

| Acesso | E-mail | Senha |
|---|---|---|
| Super admin da plataforma | definido no `.env.seed` | definido no `.env.seed` |
| Mercearia demo — admin | `ze@demo.com` | `demo123` |
| Mercearia demo — caixa | `caixa@demo.com` | `demo123` |

Para recomeçar do zero: `rm -rf .wrangler/state && npm run db:setup`.

Para testar o Worker exatamente como roda na Cloudflare (runtime `workerd`, D1 local): `npm run preview`.

## Deploy na Cloudflare

```bash
npx wrangler login
npx wrangler d1 create tafeito-db          # copie o database_id para o wrangler.jsonc
npm run db:migrate:remote                  # cria as tabelas no D1 remoto
npm run db:seed:remote                     # cria o super admin do .env.seed (sem dados demo)
npm run deploy
```

## Módulos

| Área | O que faz |
|---|---|
| **Dashboard** | Faturamento dia/7 dias/mês, ticket médio, lucro bruto, gráfico diário, top produtos por quantidade e por faturamento, margem por produto, abaixo do mínimo, produtos parados, fiado a receber/vencido, lotes vencendo |
| **PDV** | Bipa ou busca produto (`3*código` multiplica), desconto por item e geral, dinheiro (com troco), Pix, débito, crédito e fiado. Atalhos: F2 busca, F4 finaliza, Esc nova venda |
| **Vendas** | Histórico com filtros, comprovante imprimível ("não é documento fiscal"), cancelamento com estorno do estoque |
| **Produtos** | Nome, código de barras, categoria, unidade (un/kg/cx/lt/pct), custo, venda, estoque mínimo; ficha com lotes e movimentações |
| **Entradas** | Compra/reposição por fornecedor e NF; cada item vira um **lote** com validade e custo |
| **Saídas e ajustes** | Perda, quebra, vencido, consumo próprio (sempre com motivo) e ajuste de inventário por contagem física |
| **Estoque** | Saldo por produto e trilha completa de movimentações |
| **Vencimentos** | Lotes vencendo em 7/15/30 dias, fiado a receber e contas a pagar vencendo |
| **Contas a pagar** (só admin) | Fornecedor, luz, água, funcionários, aluguel etc. (categorias editáveis), lançamento único, **todo mês** ou **parcelado**, pagamento parcial, cancelamento da série, gasto do mês por categoria. A entrada de mercadoria pode gerar o boleto do fornecedor (ex.: 30/60/90 dias) |
| **Clientes / Contas a receber** | Limite de crédito, prazo padrão, saldo devedor, pagamento parcial, histórico; bloqueio automático com conta vencida ou limite estourado |
| **Configurações** (admin da loja) | Dados da mercearia, aparência e usuários (admin/operador) |
| **Admin da plataforma** | Mercearias, sessões conectadas, armazenamento por cliente, faturas mensais (base + R$/MB), suspensão de acesso, preço por cliente |

## Decisões de modelagem

- **Estoque auditável:** o saldo de um produto é sempre `SUM(movimentacoes_estoque.quantidade)` (positivo entra, negativo sai). `lotes.quantidade` é um cache por lote usado para validade.
- **FEFO:** vendas e saídas consomem primeiro o lote que vence antes. Se não houver lote suficiente, a venda acontece mesmo assim (o saldo fica negativo e aparece nos alertas) para não travar o caixa.
- **Margem congelada:** `venda_itens.custo_unitario_centavos` grava o custo no momento da venda.
- **Dinheiro em centavos** (inteiros) para evitar erro de arredondamento.
- **Status VENCIDA** do fiado é derivado (`vencimento < hoje` e não paga), nunca fica desatualizado.
- **Armazenamento para cobrança:** estimado somando o tamanho das colunas de cada tenant no D1 (inclui imagens de fundo/logo, limitadas a 700 KB cada).
- Operações de várias linhas (venda, entrada, pagamento, cancelamento) usam `db.batch()` do D1, que roda em transação.

## Estrutura

```
app/(loja)/      telas da mercearia (dashboard, pdv, produtos, ...)
app/admin/       painel do super admin
app/login/       login (aceita ?loja=slug para mostrar o visual da mercearia)
db/schema.ts     modelo de dados (Drizzle)
drizzle/         migrations SQL
lib/servicos/    regras de negócio (estoque, vendas/fiado, relatórios, plataforma)
scripts/seed.ts  super admin + dados de demonstração
```

Alterou o `db/schema.ts`? Rode `npm run db:generate` e depois `npm run db:migrate:local`.
