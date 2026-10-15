import "server-only";
import { and, count, eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { CATEGORIAS_DESPESA_PADRAO, categoriasDespesa, contasPagar, fornecedores, pagamentosContaPagar } from "@/db/schema";
import type { Db } from "@/lib/db";
import { hoje, somarDias, somarMeses } from "@/lib/formato";
import { ErroNegocio } from "./estoque";

type Batch = [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]];
export type FormaPagar = (typeof pagamentosContaPagar.$inferInsert)["forma"];
export const FORMAS_PAGAR = ["PIX", "BOLETO", "DINHEIRO", "TRANSFERENCIA", "DEBITO", "CREDITO"] as const;

/** Cria as categorias padrão (Fornecedor, Luz, Água, Funcionários…) na primeira vez que a mercearia usa o módulo. */
export async function garantirCategoriasDespesa(db: Db, tenantId: number) {
  const [{ n }] = await db.select({ n: count() }).from(categoriasDespesa).where(eq(categoriasDespesa.tenantId, tenantId));
  if (n === 0) {
    await db
      .insert(categoriasDespesa)
      .values(CATEGORIAS_DESPESA_PADRAO.map((nome) => ({ tenantId, nome })))
      .onConflictDoNothing();
  }
  const lista = await db.select().from(categoriasDespesa).where(eq(categoriasDespesa.tenantId, tenantId));
  return lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")); // SQLite ordena "Água" depois do "Z"
}

export async function idCategoriaPorNome(db: Db, tenantId: number, nome: string) {
  await garantirCategoriasDespesa(db, tenantId);
  const [c] = await db
    .select({ id: categoriasDespesa.id })
    .from(categoriasDespesa)
    .where(and(eq(categoriasDespesa.tenantId, tenantId), eq(categoriasDespesa.nome, nome)));
  return c?.id ?? null;
}

export type NovaContaPagar = {
  tenantId: number;
  usuarioId: number;
  descricao: string;
  categoriaId: number | null;
  fornecedorId: number | null;
  entradaId?: number | null;
  documento: string | null;
  observacao: string | null;
  valorCentavos: number;
  vencimento: string;
  /** UNICA: uma conta · MENSAL: repete o mesmo valor todo mês · PARCELADA: divide o valor em parcelas mensais */
  modo: "UNICA" | "MENSAL" | "PARCELADA";
  vezes: number;
  /** Intervalo entre parcelas em dias (ex.: boleto 30/60/90). Se ausente, usa meses. */
  intervaloDias?: number;
};

export async function criarContasPagar(db: Db, c: NovaContaPagar) {
  if (!c.descricao.trim()) throw new ErroNegocio("Informe a descrição.");
  if (!(c.valorCentavos > 0)) throw new ErroNegocio("Informe um valor maior que zero.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.vencimento)) throw new ErroNegocio("Informe o vencimento.");
  const vezes = c.modo === "UNICA" ? 1 : Math.trunc(c.vezes);
  if (!(vezes >= 1 && vezes <= 60)) throw new ErroNegocio("Quantidade de meses/parcelas deve ser entre 1 e 60.");

  if (c.categoriaId) {
    const [cat] = await db.select({ id: categoriasDespesa.id }).from(categoriasDespesa).where(and(eq(categoriasDespesa.id, c.categoriaId), eq(categoriasDespesa.tenantId, c.tenantId)));
    if (!cat) throw new ErroNegocio("Categoria inválida.");
  }
  if (c.fornecedorId) {
    const [f] = await db.select({ id: fornecedores.id }).from(fornecedores).where(and(eq(fornecedores.id, c.fornecedorId), eq(fornecedores.tenantId, c.tenantId)));
    if (!f) throw new ErroNegocio("Fornecedor inválido.");
  }

  // No parcelamento, o centavo que sobra da divisão vai para a primeira parcela
  const valorParcela = c.modo === "PARCELADA" ? Math.floor(c.valorCentavos / vezes) : c.valorCentavos;
  const sobra = c.modo === "PARCELADA" ? c.valorCentavos - valorParcela * vezes : 0;
  const grupo = vezes > 1 ? crypto.randomUUID() : null;

  const stmts: BatchItem<"sqlite">[] = Array.from({ length: vezes }, (_, i) =>
    db.insert(contasPagar).values({
      tenantId: c.tenantId,
      usuarioId: c.usuarioId,
      descricao: c.descricao.trim(),
      categoriaId: c.categoriaId,
      fornecedorId: c.fornecedorId,
      entradaId: c.entradaId ?? null,
      documento: c.documento,
      observacao: c.observacao,
      valorCentavos: valorParcela + (i === 0 ? sobra : 0),
      vencimento: c.intervaloDias ? somarDias(c.vencimento, c.intervaloDias * i) : somarMeses(c.vencimento, i),
      grupo,
      parcela: vezes > 1 ? i + 1 : null,
      totalParcelas: vezes > 1 ? vezes : null,
    }),
  );
  await db.batch(stmts as Batch);
  return vezes;
}

export async function pagarConta(
  db: Db,
  p: { tenantId: number; usuarioId: number; contaId: number; valorCentavos: number; forma: FormaPagar; data: string },
) {
  if (!(p.valorCentavos > 0)) throw new ErroNegocio("Informe um valor maior que zero.");
  if (!FORMAS_PAGAR.includes(p.forma)) throw new ErroNegocio("Forma de pagamento inválida.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.data)) throw new ErroNegocio("Data inválida.");
  const [c] = await db.select().from(contasPagar).where(and(eq(contasPagar.id, p.contaId), eq(contasPagar.tenantId, p.tenantId)));
  if (!c) throw new ErroNegocio("Conta não encontrada.");
  if (c.status !== "ABERTA") throw new ErroNegocio("Esta conta não está em aberto.");
  const aberto = c.valorCentavos - c.valorPagoCentavos;
  if (p.valorCentavos > aberto) throw new ErroNegocio("Valor maior que o saldo da conta.");

  await db.batch([
    db.insert(pagamentosContaPagar).values({ tenantId: p.tenantId, contaPagarId: c.id, valorCentavos: p.valorCentavos, forma: p.forma, data: p.data, usuarioId: p.usuarioId }),
    db
      .update(contasPagar)
      .set({ valorPagoCentavos: sql`${contasPagar.valorPagoCentavos} + ${p.valorCentavos}`, status: p.valorCentavos === aberto ? "PAGA" : "ABERTA" })
      .where(eq(contasPagar.id, c.id)),
  ]);
  return { quitada: p.valorCentavos === aberto, descricao: c.descricao };
}

/** Cancela a conta (ou ela e as próximas em aberto do mesmo grupo). Contas com pagamento não podem ser canceladas. */
export async function cancelarContaPagar(db: Db, tenantId: number, contaId: number, seguintes: boolean) {
  const [c] = await db.select().from(contasPagar).where(and(eq(contasPagar.id, contaId), eq(contasPagar.tenantId, tenantId)));
  if (!c) throw new ErroNegocio("Conta não encontrada.");
  if (c.status !== "ABERTA") throw new ErroNegocio("Só contas em aberto podem ser canceladas.");
  if (c.valorPagoCentavos > 0) throw new ErroNegocio("Esta conta já tem pagamento registrado e não pode ser cancelada.");

  const cond =
    seguintes && c.grupo
      ? and(eq(contasPagar.tenantId, tenantId), eq(contasPagar.grupo, c.grupo), eq(contasPagar.status, "ABERTA"), eq(contasPagar.valorPagoCentavos, 0), sql`${contasPagar.vencimento} >= ${c.vencimento}`)
      : eq(contasPagar.id, c.id);
  const r = await db.update(contasPagar).set({ status: "CANCELADA" }).where(cond).returning({ id: contasPagar.id });
  return r.length;
}

export async function resumoContasPagar(db: Db, tenantId: number) {
  const hj = hoje();
  const mes = hj.slice(0, 7);
  const [r] = await db.all<{ aberto: number; vencido: number; qtd_vencidas: number; vence_7: number; vence_mes: number }>(sql`
    select coalesce(sum(valor_centavos - valor_pago_centavos), 0) as aberto,
           coalesce(sum(case when vencimento < ${hj} then valor_centavos - valor_pago_centavos end), 0) as vencido,
           count(case when vencimento < ${hj} then 1 end) as qtd_vencidas,
           coalesce(sum(case when vencimento between ${hj} and ${somarDias(hj, 7)} then valor_centavos - valor_pago_centavos end), 0) as vence_7,
           coalesce(sum(case when substr(vencimento, 1, 7) = ${mes} then valor_centavos - valor_pago_centavos end), 0) as vence_mes
    from contas_pagar where tenant_id = ${tenantId} and status = 'ABERTA'
  `);
  const [p] = await db.all<{ pago_mes: number }>(sql`
    select coalesce(sum(valor_centavos), 0) as pago_mes from pagamentos_conta_pagar
    where tenant_id = ${tenantId} and substr(data, 1, 7) = ${mes}
  `);
  return { ...r, pagoMes: p.pago_mes };
}

/** Despesas pagas no mês agrupadas por categoria. */
export async function despesasPorCategoria(db: Db, tenantId: number, mes: string) {
  return db.all<{ categoria: string; total: number }>(sql`
    select coalesce(cd.nome, 'Sem categoria') as categoria, sum(p.valor_centavos) as total
    from pagamentos_conta_pagar p
    join contas_pagar c on c.id = p.conta_pagar_id
    left join categorias_despesa cd on cd.id = c.categoria_id
    where p.tenant_id = ${tenantId} and substr(p.data, 1, 7) = ${mes}
    group by 1 order by total desc
  `);
}
