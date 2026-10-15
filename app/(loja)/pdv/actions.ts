"use server";

import { revalidatePath } from "next/cache";
import { FORMAS_PAGAMENTO } from "@/db/schema";
import { exigirTenant } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ErroNegocio } from "@/lib/servicos/estoque";
import { registrarVenda, situacaoCredito, type SituacaoCredito } from "@/lib/servicos/vendas";

export type PayloadVenda = {
  itens: { produtoId: number; quantidade: number; descontoCentavos: number }[];
  descontoCentavos: number;
  formaPagamento: (typeof FORMAS_PAGAMENTO)[number];
  clienteId: number | null;
  valorRecebidoCentavos: number | null;
  vencimento: string | null;
};

export type ResultadoVenda = { erro: string } | { vendaId: number; total: number; troco: number | null };

export async function finalizarVenda(p: PayloadVenda): Promise<ResultadoVenda> {
  const u = await exigirTenant();
  const db = await getDb();
  try {
    const r = await registrarVenda(db, {
      tenantId: u.tenantId,
      usuarioId: u.id,
      itens: p.itens.map((i) => ({ produtoId: Number(i.produtoId), quantidade: Number(i.quantidade), descontoCentavos: Math.round(Number(i.descontoCentavos) || 0) })),
      descontoCentavos: Math.round(Number(p.descontoCentavos) || 0),
      formaPagamento: p.formaPagamento,
      clienteId: p.clienteId ? Number(p.clienteId) : null,
      valorRecebidoCentavos: p.valorRecebidoCentavos == null ? null : Math.round(Number(p.valorRecebidoCentavos)),
      vencimento: p.vencimento && /^\d{4}-\d{2}-\d{2}$/.test(p.vencimento) ? p.vencimento : null,
    });
    revalidatePath("/", "layout");
    return { vendaId: r.id, total: r.total, troco: r.troco };
  } catch (e) {
    if (e instanceof ErroNegocio) return { erro: e.message };
    console.error(e);
    return { erro: "Falha ao registrar a venda. Tente novamente." };
  }
}

export async function consultarCredito(clienteId: number): Promise<SituacaoCredito | null> {
  const u = await exigirTenant();
  const db = await getDb();
  try {
    return await situacaoCredito(db, u.tenantId, clienteId);
  } catch {
    return null;
  }
}
