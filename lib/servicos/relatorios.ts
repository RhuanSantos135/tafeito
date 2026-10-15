import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { hoje, somarDias } from "@/lib/formato";

// Datas das vendas estão em UTC; o Brasil (sem horário de verão) é UTC-3.
const DIA_LOCAL = (col: string) => `date(${col}, '-3 hours')`;

export async function resumoFaturamento(db: Db, tenantId: number) {
  const hj = hoje();
  const semana = somarDias(hj, -6);
  const mes = hj.slice(0, 8) + "01";
  const [r] = await db.all<{
    dia_total: number; dia_qtd: number; sem_total: number; sem_qtd: number; mes_total: number; mes_qtd: number; mes_custo: number;
  }>(sql`
    select
      coalesce(sum(case when ${sql.raw(DIA_LOCAL("v.data"))} = ${hj} then v.total_centavos end), 0) as dia_total,
      count(case when ${sql.raw(DIA_LOCAL("v.data"))} = ${hj} then 1 end) as dia_qtd,
      coalesce(sum(case when ${sql.raw(DIA_LOCAL("v.data"))} >= ${semana} then v.total_centavos end), 0) as sem_total,
      count(case when ${sql.raw(DIA_LOCAL("v.data"))} >= ${semana} then 1 end) as sem_qtd,
      coalesce(sum(case when ${sql.raw(DIA_LOCAL("v.data"))} >= ${mes} then v.total_centavos end), 0) as mes_total,
      count(case when ${sql.raw(DIA_LOCAL("v.data"))} >= ${mes} then 1 end) as mes_qtd,
      (select coalesce(sum(i.custo_unitario_centavos * i.quantidade), 0)
         from venda_itens i join vendas v2 on v2.id = i.venda_id
        where v2.tenant_id = ${tenantId} and v2.status = 'CONCLUIDA' and ${sql.raw(DIA_LOCAL("v2.data"))} >= ${mes}) as mes_custo
    from vendas v
    where v.tenant_id = ${tenantId} and v.status = 'CONCLUIDA' and ${sql.raw(DIA_LOCAL("v.data"))} >= ${mes < semana ? mes : semana}
  `);
  const ticket = (t: number, q: number) => (q ? Math.round(t / q) : 0);
  return {
    dia: { total: r.dia_total, vendas: r.dia_qtd, ticket: ticket(r.dia_total, r.dia_qtd) },
    semana: { total: r.sem_total, vendas: r.sem_qtd, ticket: ticket(r.sem_total, r.sem_qtd) },
    mes: { total: r.mes_total, vendas: r.mes_qtd, ticket: ticket(r.mes_total, r.mes_qtd), lucroBruto: Math.round(r.mes_total - r.mes_custo) },
  };
}

export async function vendasPorDia(db: Db, tenantId: number, dias = 30) {
  const inicio = somarDias(hoje(), -(dias - 1));
  const linhas = await db.all<{ dia: string; total: number; qtd: number }>(sql`
    select ${sql.raw(DIA_LOCAL("data"))} as dia, sum(total_centavos) as total, count(*) as qtd
    from vendas where tenant_id = ${tenantId} and status = 'CONCLUIDA' and ${sql.raw(DIA_LOCAL("data"))} >= ${inicio}
    group by dia order by dia
  `);
  const mapa = new Map(linhas.map((l) => [l.dia, l]));
  return Array.from({ length: dias }, (_, i) => {
    const dia = somarDias(inicio, i);
    return { dia, total: mapa.get(dia)?.total ?? 0, qtd: mapa.get(dia)?.qtd ?? 0 };
  });
}

export type LinhaProdutoVendido = {
  id: number; nome: string; unidade: string; quantidade: number; faturamento: number; custo: number; margem: number; margemPct: number;
};

/** Desempenho por produto no período: base para os dois rankings e a margem. */
export async function desempenhoProdutos(db: Db, tenantId: number, dias = 30): Promise<LinhaProdutoVendido[]> {
  const inicio = somarDias(hoje(), -(dias - 1));
  const linhas = await db.all<{ id: number; nome: string; unidade: string; quantidade: number; faturamento: number; custo: number }>(sql`
    select p.id, p.nome, p.unidade,
           sum(i.quantidade) as quantidade,
           sum(i.total_centavos) as faturamento,
           sum(i.custo_unitario_centavos * i.quantidade) as custo
    from venda_itens i
    join vendas v on v.id = i.venda_id
    join produtos p on p.id = i.produto_id
    where i.tenant_id = ${tenantId} and v.status = 'CONCLUIDA' and ${sql.raw(DIA_LOCAL("v.data"))} >= ${inicio}
    group by p.id
  `);
  return linhas.map((l) => {
    const margem = Math.round(l.faturamento - l.custo);
    return { ...l, custo: Math.round(l.custo), margem, margemPct: l.faturamento ? (margem / l.faturamento) * 100 : 0 };
  });
}

export async function produtosAbaixoMinimo(db: Db, tenantId: number) {
  return db.all<{ id: number; nome: string; unidade: string; estoque_minimo: number; saldo: number }>(sql`
    select p.id, p.nome, p.unidade, p.estoque_minimo,
           coalesce((select sum(m.quantidade) from movimentacoes_estoque m where m.produto_id = p.id), 0) as saldo
    from produtos p
    where p.tenant_id = ${tenantId} and p.ativo = 1 and p.estoque_minimo > 0
      and coalesce((select sum(m.quantidade) from movimentacoes_estoque m where m.produto_id = p.id), 0) <= p.estoque_minimo
    order by saldo - p.estoque_minimo
  `);
}

export async function produtosParados(db: Db, tenantId: number, dias = 30) {
  const limite = somarDias(hoje(), -dias);
  return db.all<{ id: number; nome: string; unidade: string; saldo: number; ultima_venda: string | null; valor_parado: number }>(sql`
    select x.*, cast(round(x.saldo * x.custo) as integer) as valor_parado from (
      select p.id, p.nome, p.unidade, p.preco_custo_centavos as custo,
             coalesce((select sum(m.quantidade) from movimentacoes_estoque m where m.produto_id = p.id), 0) as saldo,
             (select max(${sql.raw(DIA_LOCAL("v.data"))}) from venda_itens i join vendas v on v.id = i.venda_id
               where i.produto_id = p.id and v.status = 'CONCLUIDA') as ultima_venda
      from produtos p where p.tenant_id = ${tenantId} and p.ativo = 1
    ) x
    where x.saldo > 0 and (x.ultima_venda is null or x.ultima_venda < ${limite})
    order by x.ultima_venda is not null, x.ultima_venda
  `);
}

export async function lotesVencendo(db: Db, tenantId: number, dias = 30) {
  const hj = hoje();
  const limite = somarDias(hj, dias);
  return db.all<{ id: number; produto_id: number; nome: string; unidade: string; codigo: string | null; quantidade: number; validade: string; custo: number }>(sql`
    select l.id, l.produto_id, p.nome, p.unidade, l.codigo, l.quantidade, l.validade, l.custo_unitario_centavos as custo
    from lotes l join produtos p on p.id = l.produto_id
    where l.tenant_id = ${tenantId} and l.quantidade > 0 and l.validade is not null and l.validade <= ${limite}
    order by l.validade
  `);
}

export async function resumoFiado(db: Db, tenantId: number) {
  const hj = hoje();
  const [r] = await db.all<{ aberto: number; vencido: number; clientes: number; vence_7: number }>(sql`
    select coalesce(sum(valor_centavos - valor_pago_centavos), 0) as aberto,
           coalesce(sum(case when vencimento < ${hj} then valor_centavos - valor_pago_centavos end), 0) as vencido,
           count(distinct cliente_id) as clientes,
           coalesce(sum(case when vencimento between ${hj} and ${somarDias(hj, 7)} then valor_centavos - valor_pago_centavos end), 0) as vence_7
    from contas_receber where tenant_id = ${tenantId} and status = 'ABERTA'
  `);
  return r;
}

export async function contasAReceber(db: Db, tenantId: number, filtro: "vencidas" | "a_vencer" | "todas" = "todas") {
  const hj = hoje();
  const cond =
    filtro === "vencidas" ? sql`and c.vencimento < ${hj}` : filtro === "a_vencer" ? sql`and c.vencimento >= ${hj}` : sql``;
  return db.all<{ id: number; cliente_id: number; cliente: string; telefone: string | null; venda_id: number | null; valor: number; pago: number; vencimento: string }>(sql`
    select c.id, c.cliente_id, cl.nome as cliente, cl.telefone, c.venda_id, c.valor_centavos as valor, c.valor_pago_centavos as pago, c.vencimento
    from contas_receber c join clientes cl on cl.id = c.cliente_id
    where c.tenant_id = ${tenantId} and c.status = 'ABERTA' ${cond}
    order by c.vencimento
  `);
}
