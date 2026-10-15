import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { clientes, contasReceber, FORMAS_PAGAMENTO, lotes, movimentacoesEstoque, pagamentos, produtos, vendaItens, vendas } from "@/db/schema";
import type { Db } from "@/lib/db";
import { hoje, somarDias } from "@/lib/formato";
import { ErroNegocio, planejarBaixa, statementsBaixa } from "./estoque";

type Batch = [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]];

// ---------- Fiado ----------

export type SituacaoCredito = {
  limiteCentavos: number;
  devedorCentavos: number;
  vencidoCentavos: number;
  contasVencidas: number;
  disponivelCentavos: number;
  bloqueado: boolean;
  motivoBloqueio: string | null;
};

export async function situacaoCredito(db: Db, tenantId: number, clienteId: number): Promise<SituacaoCredito> {
  const [c] = await db
    .select({ limite: clientes.limiteCreditoCentavos, ativo: clientes.ativo })
    .from(clientes)
    .where(and(eq(clientes.id, clienteId), eq(clientes.tenantId, tenantId)));
  if (!c) throw new ErroNegocio("Cliente não encontrado.");
  const hj = hoje();
  const [r] = await db
    .select({
      devedor: sql<number>`coalesce(sum(${contasReceber.valorCentavos} - ${contasReceber.valorPagoCentavos}), 0)`,
      vencido: sql<number>`coalesce(sum(case when ${contasReceber.vencimento} < ${hj} then ${contasReceber.valorCentavos} - ${contasReceber.valorPagoCentavos} else 0 end), 0)`,
      qtdVencidas: sql<number>`coalesce(sum(case when ${contasReceber.vencimento} < ${hj} then 1 else 0 end), 0)`,
    })
    .from(contasReceber)
    .where(and(eq(contasReceber.tenantId, tenantId), eq(contasReceber.clienteId, clienteId), eq(contasReceber.status, "ABERTA")));

  const disponivel = c.limite - r.devedor;
  let motivo: string | null = null;
  if (!c.ativo) motivo = "Cliente inativo";
  else if (r.qtdVencidas > 0) motivo = `Possui ${r.qtdVencidas} conta(s) vencida(s)`;
  else if (disponivel <= 0) motivo = "Limite de crédito esgotado";
  return {
    limiteCentavos: c.limite,
    devedorCentavos: r.devedor,
    vencidoCentavos: r.vencido,
    contasVencidas: r.qtdVencidas,
    disponivelCentavos: Math.max(0, disponivel),
    bloqueado: motivo !== null,
    motivoBloqueio: motivo,
  };
}

/** Recebe um pagamento do cliente, quitando as contas mais antigas primeiro (aceita parcial). */
export async function receberPagamento(
  db: Db,
  d: { tenantId: number; usuarioId: number; clienteId: number; valorCentavos: number; forma: "DINHEIRO" | "PIX" | "DEBITO" | "CREDITO"; contaId?: number },
) {
  if (!(d.valorCentavos > 0)) throw new ErroNegocio("Informe um valor maior que zero.");
  const abertas = await db
    .select()
    .from(contasReceber)
    .where(
      and(
        eq(contasReceber.tenantId, d.tenantId),
        eq(contasReceber.clienteId, d.clienteId),
        eq(contasReceber.status, "ABERTA"),
        d.contaId ? eq(contasReceber.id, d.contaId) : undefined,
      ),
    )
    .orderBy(asc(contasReceber.vencimento), asc(contasReceber.id));
  const devido = abertas.reduce((s, c) => s + c.valorCentavos - c.valorPagoCentavos, 0);
  if (!abertas.length) throw new ErroNegocio("Não há contas em aberto.");
  if (d.valorCentavos > devido) throw new ErroNegocio("Valor maior que o saldo devedor.");

  const stmts: BatchItem<"sqlite">[] = [];
  let restante = d.valorCentavos;
  for (const c of abertas) {
    if (restante <= 0) break;
    const aberto = c.valorCentavos - c.valorPagoCentavos;
    const pagar = Math.min(aberto, restante);
    restante -= pagar;
    stmts.push(
      db.insert(pagamentos).values({ tenantId: d.tenantId, contaReceberId: c.id, valorCentavos: pagar, forma: d.forma, usuarioId: d.usuarioId }),
      db
        .update(contasReceber)
        .set({ valorPagoCentavos: c.valorPagoCentavos + pagar, status: pagar === aberto ? "PAGA" : "ABERTA" })
        .where(eq(contasReceber.id, c.id)),
    );
  }
  await db.batch(stmts as Batch);
}

// ---------- Venda ----------

export type ItemVenda = { produtoId: number; quantidade: number; descontoCentavos?: number };

export type NovaVenda = {
  tenantId: number;
  usuarioId: number;
  itens: ItemVenda[];
  descontoCentavos: number;
  formaPagamento: (typeof FORMAS_PAGAMENTO)[number];
  clienteId: number | null;
  valorRecebidoCentavos: number | null;
  vencimento: string | null;
};

export async function registrarVenda(db: Db, v: NovaVenda) {
  if (!v.itens.length) throw new ErroNegocio("Carrinho vazio.");
  if (!FORMAS_PAGAMENTO.includes(v.formaPagamento)) throw new ErroNegocio("Forma de pagamento inválida.");
  for (const i of v.itens) if (!(i.quantidade > 0)) throw new ErroNegocio("Quantidade inválida.");

  const ids = [...new Set(v.itens.map((i) => i.produtoId))];
  const prods = await db
    .select()
    .from(produtos)
    .where(and(eq(produtos.tenantId, v.tenantId), inArray(produtos.id, ids), eq(produtos.ativo, true)));
  const porId = new Map(prods.map((p) => [p.id, p]));
  if (porId.size !== ids.length) throw new ErroNegocio("Produto inválido ou inativo no carrinho.");

  // Preço vem sempre do cadastro (nunca do navegador)
  const linhas = v.itens.map((i) => {
    const p = porId.get(i.produtoId)!;
    const bruto = Math.round(p.precoVendaCentavos * i.quantidade);
    const desconto = Math.min(Math.max(0, i.descontoCentavos ?? 0), bruto);
    return { ...i, produto: p, bruto, desconto, total: bruto - desconto };
  });
  const subtotal = linhas.reduce((s, l) => s + l.total, 0);
  const descontoGeral = Math.min(Math.max(0, v.descontoCentavos), subtotal);
  const total = subtotal - descontoGeral;

  let vencimento: string | null = null;
  if (v.formaPagamento === "PRAZO") {
    if (!v.clienteId) throw new ErroNegocio("Venda a prazo exige cliente.");
    const sit = await situacaoCredito(db, v.tenantId, v.clienteId);
    if (sit.bloqueado) throw new ErroNegocio(`Fiado bloqueado: ${sit.motivoBloqueio}.`);
    if (total > sit.disponivelCentavos) throw new ErroNegocio("Venda ultrapassa o limite de crédito disponível do cliente.");
    const [c] = await db.select({ dias: clientes.diasPrazo }).from(clientes).where(eq(clientes.id, v.clienteId));
    vencimento = v.vencimento || somarDias(hoje(), c.dias);
  } else if (v.clienteId) {
    const [c] = await db
      .select({ id: clientes.id })
      .from(clientes)
      .where(and(eq(clientes.id, v.clienteId), eq(clientes.tenantId, v.tenantId)));
    if (!c) throw new ErroNegocio("Cliente inválido.");
  }

  let troco: number | null = null;
  if (v.formaPagamento === "DINHEIRO" && v.valorRecebidoCentavos != null) {
    if (v.valorRecebidoCentavos < total) throw new ErroNegocio("Valor recebido menor que o total.");
    troco = v.valorRecebidoCentavos - total;
  }

  // Planeja a baixa de estoque (FEFO) e o custo congelado de cada item
  const planos = [];
  for (const l of linhas) {
    const consumos = await planejarBaixa(db, v.tenantId, l.produtoId, l.quantidade, l.produto.precoCustoCentavos);
    const custoTotal = consumos.reduce((s, c) => s + c.quantidade * c.custoUnitarioCentavos, 0);
    planos.push({ linha: l, consumos, custoUnitario: Math.round(custoTotal / l.quantidade) });
  }

  const [venda] = await db
    .insert(vendas)
    .values({
      tenantId: v.tenantId,
      clienteId: v.clienteId,
      usuarioId: v.usuarioId,
      subtotalCentavos: subtotal,
      descontoCentavos: descontoGeral,
      totalCentavos: total,
      formaPagamento: v.formaPagamento,
      valorRecebidoCentavos: v.formaPagamento === "DINHEIRO" ? (v.valorRecebidoCentavos ?? total) : null,
      trocoCentavos: troco,
    })
    .returning({ id: vendas.id });

  const stmts: BatchItem<"sqlite">[] = [];
  for (const { linha, consumos, custoUnitario } of planos) {
    stmts.push(
      db.insert(vendaItens).values({
        tenantId: v.tenantId,
        vendaId: venda.id,
        produtoId: linha.produtoId,
        quantidade: linha.quantidade,
        precoUnitarioCentavos: linha.produto.precoVendaCentavos,
        custoUnitarioCentavos: custoUnitario,
        descontoCentavos: linha.desconto,
        totalCentavos: linha.total,
      }),
      ...statementsBaixa(db, { tenantId: v.tenantId, produtoId: linha.produtoId, usuarioId: v.usuarioId, tipo: "VENDA", vendaId: venda.id }, consumos),
    );
  }
  if (v.formaPagamento === "PRAZO" && v.clienteId && vencimento) {
    stmts.push(
      db.insert(contasReceber).values({ tenantId: v.tenantId, vendaId: venda.id, clienteId: v.clienteId, valorCentavos: total, vencimento }),
    );
  }

  try {
    await db.batch(stmts as Batch);
  } catch (e) {
    await db.delete(vendas).where(eq(vendas.id, venda.id));
    throw e;
  }
  return { id: venda.id, total, troco };
}

/** Cancela a venda devolvendo o estoque aos mesmos lotes (movimentação ESTORNO). */
export async function cancelarVenda(db: Db, tenantId: number, usuarioId: number, vendaId: number) {
  const [venda] = await db
    .select()
    .from(vendas)
    .where(and(eq(vendas.id, vendaId), eq(vendas.tenantId, tenantId)));
  if (!venda) throw new ErroNegocio("Venda não encontrada.");
  if (venda.status === "CANCELADA") throw new ErroNegocio("Venda já cancelada.");

  const contas = await db.select().from(contasReceber).where(eq(contasReceber.vendaId, vendaId));
  if (contas.some((c) => c.valorPagoCentavos > 0)) throw new ErroNegocio("Venda a prazo com pagamentos recebidos não pode ser cancelada.");

  const movs = await db
    .select()
    .from(movimentacoesEstoque)
    .where(and(eq(movimentacoesEstoque.vendaId, vendaId), eq(movimentacoesEstoque.tipo, "VENDA"), eq(movimentacoesEstoque.tenantId, tenantId)));

  const stmts: BatchItem<"sqlite">[] = [db.update(vendas).set({ status: "CANCELADA" }).where(eq(vendas.id, vendaId))];
  for (const m of movs) {
    stmts.push(
      db.insert(movimentacoesEstoque).values({
        tenantId,
        produtoId: m.produtoId,
        loteId: m.loteId,
        tipo: "ESTORNO",
        quantidade: -m.quantidade,
        motivo: "CANCELAMENTO_VENDA",
        vendaId,
        usuarioId,
      }),
    );
    if (m.loteId) {
      stmts.push(
        db
          .update(lotes)
          .set({ quantidade: sql`round(${lotes.quantidade} + ${-m.quantidade}, 3)` })
          .where(eq(lotes.id, m.loteId)),
      );
    }
  }
  for (const c of contas) stmts.push(db.update(contasReceber).set({ status: "CANCELADA" }).where(eq(contasReceber.id, c.id)));
  await db.batch(stmts as Batch);
}

export function statusConta(c: { status: string; vencimento: string }, hj = hoje()) {
  if (c.status === "ABERTA" && c.vencimento < hj) return "VENCIDA" as const;
  return c.status as "ABERTA" | "PAGA" | "CANCELADA";
}

