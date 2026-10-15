"use server";

import { revalidatePath } from "next/cache";
import type { EstadoAcao } from "@/components/formulario";
import { MOTIVOS_SAIDA } from "@/db/schema";
import { inteiro, tentar, texto } from "@/lib/acao";
import { exigirTenant } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { paraNumero, qtd } from "@/lib/formato";
import { ajustarInventario, ErroNegocio, registrarSaida } from "@/lib/servicos/estoque";

export async function salvarSaida(_: EstadoAcao, fd: FormData) {
  return tentar(async () => {
    const u = await exigirTenant();
    const produtoId = inteiro(fd, "produtoId");
    const motivo = String(fd.get("motivo") ?? "");
    if (!produtoId) throw new ErroNegocio("Selecione o produto.");
    if (!(MOTIVOS_SAIDA as readonly string[]).includes(motivo) || motivo === "AJUSTE_INVENTARIO") throw new ErroNegocio("Selecione o motivo.");
    const db = await getDb();
    await registrarSaida(db, {
      tenantId: u.tenantId,
      usuarioId: u.id,
      produtoId,
      quantidade: paraNumero(fd.get("quantidade")),
      motivo,
      observacao: texto(fd, "observacao"),
      loteId: inteiro(fd, "loteId") ?? undefined,
    });
    revalidatePath("/saidas");
    return { ok: "Saída registrada.", t: Date.now() };
  });
}

export async function salvarAjuste(_: EstadoAcao, fd: FormData) {
  return tentar(async () => {
    const u = await exigirTenant();
    const produtoId = inteiro(fd, "produtoId");
    if (!produtoId) throw new ErroNegocio("Selecione o produto.");
    const contagem = String(fd.get("contagem") ?? "").trim();
    if (!contagem) throw new ErroNegocio("Informe a quantidade contada.");
    const db = await getDb();
    const dif = await ajustarInventario(db, { tenantId: u.tenantId, usuarioId: u.id, produtoId, contagem: paraNumero(contagem), observacao: texto(fd, "observacao") });
    revalidatePath("/saidas");
    return { ok: `Ajuste lançado: ${dif > 0 ? "+" : ""}${qtd(dif)}.`, t: Date.now() };
  });
}
