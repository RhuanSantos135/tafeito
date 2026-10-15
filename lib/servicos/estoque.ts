import "server-only";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { entradas, lotes, movimentacoesEstoque, produtos } from "@/db/schema";
import type { Db } from "@/lib/db";

export class ErroNegocio extends Error {}

/** Saldo de cada produto = soma das movimentações (fonte da verdade auditável). */
export async function saldos(db: Db, tenantId: number, produtoIds?: number[]) {
  const linhas = await db
    .select({ produtoId: movimentacoesEstoque.produtoId, saldo: sql<number>`coalesce(sum(${movimentacoesEstoque.quantidade}), 0)` })
    .from(movimentacoesEstoque)
    .where(
      and(
        eq(movimentacoesEstoque.tenantId, tenantId),
        produtoIds?.length ? inArray(movimentacoesEstoque.produtoId, produtoIds) : undefined,
      ),
    )
    .groupBy(movimentacoesEstoque.produtoId);
  return new Map(linhas.map((l) => [l.produtoId, arredondar(l.saldo)]));
}

export function arredondar(n: number) {
  return Math.round(n * 1000) / 1000;
}

export type Consumo = { loteId: number | null; quantidade: number; custoUnitarioCentavos: number };

/**
 * Planeja a baixa de uma quantidade usando FEFO (primeiro que vence, primeiro que sai).
 * Se os lotes não cobrirem tudo, o restante sai "sem lote" com o custo do cadastro,
 * permitindo vender mesmo com estoque não lançado (o saldo fica negativo e aparece nos alertas).
 */
export async function planejarBaixa(db: Db, tenantId: number, produtoId: number, quantidade: number, custoPadrao: number, loteId?: number) {
  const disponiveis = await db
    .select({ id: lotes.id, quantidade: lotes.quantidade, custo: lotes.custoUnitarioCentavos })
    .from(lotes)
    .where(and(eq(lotes.tenantId, tenantId), eq(lotes.produtoId, produtoId), gt(lotes.quantidade, 0), loteId ? eq(lotes.id, loteId) : undefined))
    .orderBy(sql`${lotes.validade} is null`, asc(lotes.validade), asc(lotes.id));

  const consumos: Consumo[] = [];
  let restante = quantidade;
  for (const l of disponiveis) {
    if (restante <= 0) break;
    const usar = arredondar(Math.min(l.quantidade, restante));
    consumos.push({ loteId: l.id, quantidade: usar, custoUnitarioCentavos: l.custo });
    restante = arredondar(restante - usar);
  }
  if (restante > 0) consumos.push({ loteId: null, quantidade: restante, custoUnitarioCentavos: custoPadrao });
  return consumos;
}

/** Statements que aplicam uma baixa planejada (movimentações + saldo dos lotes). */
export function statementsBaixa(
  db: Db,
  base: { tenantId: number; produtoId: number; usuarioId: number; tipo: "SAIDA" | "VENDA" | "AJUSTE"; motivo?: string | null; observacao?: string | null; vendaId?: number },
  consumos: Consumo[],
) {
  const stmts: BatchItem<"sqlite">[] = [];
  for (const c of consumos) {
    stmts.push(
      db.insert(movimentacoesEstoque).values({
        tenantId: base.tenantId,
        produtoId: base.produtoId,
        loteId: c.loteId,
        tipo: base.tipo,
        quantidade: -c.quantidade,
        motivo: base.motivo ?? null,
        observacao: base.observacao ?? null,
        vendaId: base.vendaId ?? null,
        usuarioId: base.usuarioId,
      }),
    );
    if (c.loteId) {
      stmts.push(
        db
          .update(lotes)
          .set({ quantidade: sql`round(${lotes.quantidade} - ${c.quantidade}, 3)` })
          .where(and(eq(lotes.id, c.loteId), eq(lotes.tenantId, base.tenantId))),
      );
    }
  }
  return stmts;
}

export type ItemEntrada = { produtoId: number; quantidade: number; custoUnitarioCentavos: number; validade: string | null; codigoLote: string | null };

export async function registrarEntrada(
  db: Db,
  dados: { tenantId: number; usuarioId: number; fornecedorId: number | null; notaFiscal: string | null; data: string; observacao: string | null; itens: ItemEntrada[] },
) {
  if (!dados.itens.length) throw new ErroNegocio("Adicione ao menos um produto.");
  for (const i of dados.itens) {
    if (!(i.quantidade > 0)) throw new ErroNegocio("Quantidade deve ser maior que zero.");
    if (i.custoUnitarioCentavos < 0) throw new ErroNegocio("Custo inválido.");
  }
  const validos = await db
    .select({ id: produtos.id })
    .from(produtos)
    .where(and(eq(produtos.tenantId, dados.tenantId), inArray(produtos.id, dados.itens.map((i) => i.produtoId))));
  if (validos.length !== new Set(dados.itens.map((i) => i.produtoId)).size) throw new ErroNegocio("Produto inválido.");

  const total = dados.itens.reduce((s, i) => s + Math.round(i.quantidade * i.custoUnitarioCentavos), 0);
  const [entrada] = await db
    .insert(entradas)
    .values({
      tenantId: dados.tenantId,
      fornecedorId: dados.fornecedorId,
      notaFiscal: dados.notaFiscal,
      data: dados.data,
      observacao: dados.observacao,
      totalCentavos: total,
      usuarioId: dados.usuarioId,
    })
    .returning({ id: entradas.id });

  const stmts: BatchItem<"sqlite">[] = [];
  for (const i of dados.itens) {
    stmts.push(
      db.insert(lotes).values({
        tenantId: dados.tenantId,
        produtoId: i.produtoId,
        entradaId: entrada.id,
        codigo: i.codigoLote,
        quantidadeInicial: i.quantidade,
        quantidade: i.quantidade,
        validade: i.validade,
        custoUnitarioCentavos: i.custoUnitarioCentavos,
      }),
      // last_insert_rowid() aponta para o lote recém-criado (o batch roda em sequência numa transação)
      db.insert(movimentacoesEstoque).values({
        tenantId: dados.tenantId,
        produtoId: i.produtoId,
        loteId: sql`last_insert_rowid()`,
        tipo: "ENTRADA",
        quantidade: i.quantidade,
        entradaId: entrada.id,
        usuarioId: dados.usuarioId,
      }),
      db
        .update(produtos)
        .set({ precoCustoCentavos: i.custoUnitarioCentavos })
        .where(and(eq(produtos.id, i.produtoId), eq(produtos.tenantId, dados.tenantId))),
    );
  }
  try {
    await db.batch(stmts as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
  } catch (e) {
    await db.delete(entradas).where(eq(entradas.id, entrada.id));
    throw e;
  }
  return entrada.id;
}

export async function registrarSaida(
  db: Db,
  d: { tenantId: number; usuarioId: number; produtoId: number; quantidade: number; motivo: string; observacao: string | null; loteId?: number },
) {
  if (!(d.quantidade > 0)) throw new ErroNegocio("Quantidade deve ser maior que zero.");
  if (!d.motivo) throw new ErroNegocio("Informe o motivo da saída.");
  const [p] = await db
    .select()
    .from(produtos)
    .where(and(eq(produtos.id, d.produtoId), eq(produtos.tenantId, d.tenantId)));
  if (!p) throw new ErroNegocio("Produto não encontrado.");

  const saldo = (await saldos(db, d.tenantId, [d.produtoId])).get(d.produtoId) ?? 0;
  if (d.quantidade > saldo) throw new ErroNegocio(`Quantidade maior que o saldo em estoque (${saldo}).`);
  const consumos = await planejarBaixa(db, d.tenantId, d.produtoId, d.quantidade, p.precoCustoCentavos, d.loteId);
  if (d.loteId && consumos.some((c) => c.loteId === null)) throw new ErroNegocio("Quantidade maior que o saldo do lote.");

  const stmts = statementsBaixa(db, { ...d, tipo: "SAIDA" }, consumos);
  await db.batch(stmts as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
}

/** Ajuste de inventário: informa a contagem física e o sistema lança a diferença. */
export async function ajustarInventario(db: Db, d: { tenantId: number; usuarioId: number; produtoId: number; contagem: number; observacao: string | null }) {
  if (d.contagem < 0) throw new ErroNegocio("Contagem não pode ser negativa.");
  const [p] = await db
    .select()
    .from(produtos)
    .where(and(eq(produtos.id, d.produtoId), eq(produtos.tenantId, d.tenantId)));
  if (!p) throw new ErroNegocio("Produto não encontrado.");
  const saldo = (await saldos(db, d.tenantId, [d.produtoId])).get(d.produtoId) ?? 0;
  const diferenca = arredondar(d.contagem - saldo);
  if (diferenca === 0) throw new ErroNegocio("A contagem é igual ao saldo do sistema. Nada a ajustar.");

  if (diferenca < 0) {
    const consumos = await planejarBaixa(db, d.tenantId, d.produtoId, -diferenca, p.precoCustoCentavos);
    const stmts = statementsBaixa(db, { ...d, tipo: "AJUSTE", motivo: "AJUSTE_INVENTARIO" }, consumos);
    await db.batch(stmts as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
  } else {
    await db.insert(movimentacoesEstoque).values({
      tenantId: d.tenantId,
      produtoId: d.produtoId,
      tipo: "AJUSTE",
      quantidade: diferenca,
      motivo: "AJUSTE_INVENTARIO",
      observacao: d.observacao,
      usuarioId: d.usuarioId,
    });
  }
  return diferenca;
}
