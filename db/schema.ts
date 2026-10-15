import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// Convenções:
// - Valores monetários em centavos (integer) para evitar erro de arredondamento.
// - Quantidades em real (aceita kg fracionado).
// - Datas "de calendário" (validade, vencimento) em texto YYYY-MM-DD.
// - Timestamps em texto ISO-8601 UTC.
// - Toda tabela de negócio tem tenant_id: cada mercearia só enxerga os próprios dados.

const agora = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

// ---------- Plataforma ----------

export const tenants = sqliteTable("tenants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nome: text("nome").notNull(),
  slug: text("slug").notNull().unique(),
  documento: text("documento"),
  email: text("email"),
  telefone: text("telefone"),
  ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
  // Personalização visual (padrão "Tá Feito" quando nulo)
  corPrimaria: text("cor_primaria"),
  corSecundaria: text("cor_secundaria"),
  fundoUrl: text("fundo_url"),
  logoUrl: text("logo_url"),
  // Cobrança
  valorBaseCentavos: integer("valor_base_centavos"),
  valorPorMbCentavos: integer("valor_por_mb_centavos"),
  criadoEm: text("criado_em").notNull().default(agora),
});

export const usuarios = sqliteTable(
  "usuarios",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // Nulo apenas para o SUPERADMIN da plataforma
    tenantId: integer("tenant_id").references(() => tenants.id),
    nome: text("nome").notNull(),
    email: text("email").notNull(),
    senhaHash: text("senha_hash").notNull(),
    papel: text("papel", { enum: ["SUPERADMIN", "ADMIN", "OPERADOR"] }).notNull(),
    ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
    criadoEm: text("criado_em").notNull().default(agora),
  },
  (t) => [uniqueIndex("usuarios_email_uq").on(t.email)],
);

export const sessoes = sqliteTable("sessoes", {
  id: text("id").primaryKey(),
  usuarioId: integer("usuario_id")
    .notNull()
    .references(() => usuarios.id),
  expiraEm: text("expira_em").notNull(),
  criadoEm: text("criado_em").notNull().default(agora),
});

export const configuracoes = sqliteTable("configuracoes", {
  chave: text("chave").primaryKey(),
  valor: text("valor").notNull(),
});

export const faturas = sqliteTable(
  "faturas",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id),
    competencia: text("competencia").notNull(), // YYYY-MM
    armazenamentoBytes: integer("armazenamento_bytes").notNull(),
    valorBaseCentavos: integer("valor_base_centavos").notNull(),
    valorArmazenamentoCentavos: integer("valor_armazenamento_centavos").notNull(),
    totalCentavos: integer("total_centavos").notNull(),
    vencimento: text("vencimento").notNull(),
    status: text("status", { enum: ["ABERTA", "PAGA", "CANCELADA"] }).notNull().default("ABERTA"),
    pagaEm: text("paga_em"),
    criadoEm: text("criado_em").notNull().default(agora),
  },
  (t) => [uniqueIndex("faturas_tenant_competencia_uq").on(t.tenantId, t.competencia)],
);

// ---------- Cadastros ----------

export const categorias = sqliteTable(
  "categorias",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id),
    nome: text("nome").notNull(),
  },
  (t) => [uniqueIndex("categorias_tenant_nome_uq").on(t.tenantId, t.nome)],
);

export const produtos = sqliteTable(
  "produtos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id),
    nome: text("nome").notNull(),
    codigoBarras: text("codigo_barras"),
    categoriaId: integer("categoria_id").references(() => categorias.id),
    unidade: text("unidade", { enum: ["UN", "KG", "CX", "LT", "PCT"] }).notNull().default("UN"),
    precoCustoCentavos: integer("preco_custo_centavos").notNull().default(0),
    precoVendaCentavos: integer("preco_venda_centavos").notNull().default(0),
    estoqueMinimo: real("estoque_minimo").notNull().default(0),
    ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
    criadoEm: text("criado_em").notNull().default(agora),
  },
  (t) => [
    index("produtos_tenant_idx").on(t.tenantId),
    uniqueIndex("produtos_tenant_barras_uq").on(t.tenantId, t.codigoBarras),
  ],
);

export const fornecedores = sqliteTable("fornecedores", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id),
  nome: text("nome").notNull(),
  documento: text("documento"),
  telefone: text("telefone"),
  criadoEm: text("criado_em").notNull().default(agora),
});

export const clientes = sqliteTable(
  "clientes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id),
    nome: text("nome").notNull(),
    telefone: text("telefone"),
    cpf: text("cpf"),
    limiteCreditoCentavos: integer("limite_credito_centavos").notNull().default(0),
    diasPrazo: integer("dias_prazo").notNull().default(30),
    ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
    criadoEm: text("criado_em").notNull().default(agora),
  },
  (t) => [index("clientes_tenant_idx").on(t.tenantId)],
);

// ---------- Estoque ----------

export const entradas = sqliteTable("entradas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id),
  fornecedorId: integer("fornecedor_id").references(() => fornecedores.id),
  notaFiscal: text("nota_fiscal"),
  data: text("data").notNull(), // YYYY-MM-DD
  totalCentavos: integer("total_centavos").notNull().default(0),
  observacao: text("observacao"),
  usuarioId: integer("usuario_id").references(() => usuarios.id),
  criadoEm: text("criado_em").notNull().default(agora),
});

export const lotes = sqliteTable(
  "lotes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id),
    produtoId: integer("produto_id")
      .notNull()
      .references(() => produtos.id),
    entradaId: integer("entrada_id").references(() => entradas.id),
    codigo: text("codigo"),
    quantidadeInicial: real("quantidade_inicial").notNull(),
    // Saldo atual do lote (cache; a fonte da verdade é movimentacoes_estoque)
    quantidade: real("quantidade").notNull(),
    validade: text("validade"), // YYYY-MM-DD, nulo = não perecível
    custoUnitarioCentavos: integer("custo_unitario_centavos").notNull(),
    criadoEm: text("criado_em").notNull().default(agora),
  },
  (t) => [index("lotes_tenant_produto_idx").on(t.tenantId, t.produtoId), index("lotes_validade_idx").on(t.tenantId, t.validade)],
);

export const TIPOS_MOVIMENTACAO = ["ENTRADA", "SAIDA", "VENDA", "AJUSTE", "ESTORNO"] as const;
export const MOTIVOS_SAIDA = ["PERDA", "QUEBRA", "VENCIDO", "CONSUMO_PROPRIO", "AJUSTE_INVENTARIO"] as const;

// Quantidade é sinalizada: positiva entra, negativa sai. Saldo = SUM(quantidade).
export const movimentacoesEstoque = sqliteTable(
  "movimentacoes_estoque",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id),
    produtoId: integer("produto_id")
      .notNull()
      .references(() => produtos.id),
    loteId: integer("lote_id").references(() => lotes.id),
    tipo: text("tipo", { enum: TIPOS_MOVIMENTACAO }).notNull(),
    quantidade: real("quantidade").notNull(),
    motivo: text("motivo"),
    observacao: text("observacao"),
    entradaId: integer("entrada_id").references(() => entradas.id),
    vendaId: integer("venda_id"),
    usuarioId: integer("usuario_id").references(() => usuarios.id),
    data: text("data").notNull().default(agora),
  },
  (t) => [index("mov_tenant_produto_idx").on(t.tenantId, t.produtoId), index("mov_tenant_data_idx").on(t.tenantId, t.data)],
);

// ---------- Vendas e fiado ----------

export const FORMAS_PAGAMENTO = ["DINHEIRO", "PIX", "DEBITO", "CREDITO", "PRAZO"] as const;

export const vendas = sqliteTable(
  "vendas",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id),
    clienteId: integer("cliente_id").references(() => clientes.id),
    usuarioId: integer("usuario_id").references(() => usuarios.id),
    data: text("data").notNull().default(agora),
    subtotalCentavos: integer("subtotal_centavos").notNull(),
    descontoCentavos: integer("desconto_centavos").notNull().default(0),
    totalCentavos: integer("total_centavos").notNull(),
    formaPagamento: text("forma_pagamento", { enum: FORMAS_PAGAMENTO }).notNull(),
    valorRecebidoCentavos: integer("valor_recebido_centavos"),
    trocoCentavos: integer("troco_centavos"),
    status: text("status", { enum: ["CONCLUIDA", "CANCELADA"] }).notNull().default("CONCLUIDA"),
  },
  (t) => [index("vendas_tenant_data_idx").on(t.tenantId, t.data)],
);

export const vendaItens = sqliteTable(
  "venda_itens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id),
    vendaId: integer("venda_id")
      .notNull()
      .references(() => vendas.id),
    produtoId: integer("produto_id")
      .notNull()
      .references(() => produtos.id),
    quantidade: real("quantidade").notNull(),
    precoUnitarioCentavos: integer("preco_unitario_centavos").notNull(),
    // Congela o custo no momento da venda: a margem histórica não muda se o custo mudar depois
    custoUnitarioCentavos: integer("custo_unitario_centavos").notNull(),
    descontoCentavos: integer("desconto_centavos").notNull().default(0),
    totalCentavos: integer("total_centavos").notNull(),
  },
  (t) => [index("venda_itens_venda_idx").on(t.vendaId), index("venda_itens_tenant_produto_idx").on(t.tenantId, t.produtoId)],
);

// Status VENCIDA é derivado (vencimento < hoje e não paga), não persistido
export const contasReceber = sqliteTable(
  "contas_receber",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id),
    vendaId: integer("venda_id").references(() => vendas.id),
    clienteId: integer("cliente_id")
      .notNull()
      .references(() => clientes.id),
    valorCentavos: integer("valor_centavos").notNull(),
    valorPagoCentavos: integer("valor_pago_centavos").notNull().default(0),
    vencimento: text("vencimento").notNull(),
    status: text("status", { enum: ["ABERTA", "PAGA", "CANCELADA"] }).notNull().default("ABERTA"),
    criadoEm: text("criado_em").notNull().default(agora),
  },
  (t) => [index("contas_tenant_cliente_idx").on(t.tenantId, t.clienteId), index("contas_tenant_venc_idx").on(t.tenantId, t.vencimento)],
);

export const pagamentos = sqliteTable("pagamentos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id),
  contaReceberId: integer("conta_receber_id")
    .notNull()
    .references(() => contasReceber.id),
  valorCentavos: integer("valor_centavos").notNull(),
  forma: text("forma", { enum: ["DINHEIRO", "PIX", "DEBITO", "CREDITO"] }).notNull(),
  data: text("data").notNull().default(agora),
  usuarioId: integer("usuario_id").references(() => usuarios.id),
});

// ---------- Contas a pagar ----------

export const CATEGORIAS_DESPESA_PADRAO = [
  "Fornecedor",
  "Energia (luz)",
  "Água",
  "Funcionários",
  "Aluguel",
  "Internet e telefone",
  "Impostos e taxas",
  "Manutenção",
  "Outros",
] as const;

export const categoriasDespesa = sqliteTable(
  "categorias_despesa",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id),
    nome: text("nome").notNull(),
  },
  (t) => [uniqueIndex("categorias_despesa_tenant_nome_uq").on(t.tenantId, t.nome)],
);

// Status VENCIDA é derivado, como em contas_receber
export const contasPagar = sqliteTable(
  "contas_pagar",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id),
    descricao: text("descricao").notNull(),
    categoriaId: integer("categoria_id").references(() => categoriasDespesa.id),
    fornecedorId: integer("fornecedor_id").references(() => fornecedores.id),
    entradaId: integer("entrada_id").references(() => entradas.id),
    documento: text("documento"), // nº do boleto / NF
    valorCentavos: integer("valor_centavos").notNull(),
    valorPagoCentavos: integer("valor_pago_centavos").notNull().default(0),
    vencimento: text("vencimento").notNull(),
    // Contas geradas juntas (repetição mensal ou parcelas) compartilham o grupo
    grupo: text("grupo"),
    parcela: integer("parcela"),
    totalParcelas: integer("total_parcelas"),
    status: text("status", { enum: ["ABERTA", "PAGA", "CANCELADA"] }).notNull().default("ABERTA"),
    observacao: text("observacao"),
    usuarioId: integer("usuario_id").references(() => usuarios.id),
    criadoEm: text("criado_em").notNull().default(agora),
  },
  (t) => [index("contas_pagar_tenant_venc_idx").on(t.tenantId, t.vencimento), index("contas_pagar_tenant_cat_idx").on(t.tenantId, t.categoriaId)],
);

export const pagamentosContaPagar = sqliteTable("pagamentos_conta_pagar", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id),
  contaPagarId: integer("conta_pagar_id")
    .notNull()
    .references(() => contasPagar.id),
  valorCentavos: integer("valor_centavos").notNull(),
  forma: text("forma", { enum: ["DINHEIRO", "PIX", "DEBITO", "CREDITO", "BOLETO", "TRANSFERENCIA"] }).notNull(),
  data: text("data").notNull(), // YYYY-MM-DD
  usuarioId: integer("usuario_id").references(() => usuarios.id),
  criadoEm: text("criado_em").notNull().default(agora),
});

// Tabelas com dados do cliente — usadas no cálculo de armazenamento para faturamento
export const TABELAS_TENANT = {
  categorias,
  produtos,
  fornecedores,
  clientes,
  entradas,
  lotes,
  movimentacoes_estoque: movimentacoesEstoque,
  vendas,
  venda_itens: vendaItens,
  contas_receber: contasReceber,
  pagamentos,
  categorias_despesa: categoriasDespesa,
  contas_pagar: contasPagar,
  pagamentos_conta_pagar: pagamentosContaPagar,
} as const;
