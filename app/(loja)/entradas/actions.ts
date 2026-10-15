"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoAcao } from "@/components/formulario";
import { inteiro, tentar, texto } from "@/lib/acao";
import { exigirTenant } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { hoje } from "@/lib/formato";
import { eq } from "drizzle-orm";
import { entradas } from "@/db/schema";
import { criarContasPagar, idCategoriaPorNome } from "@/lib/servicos/contas-pagar";
import { ErroNegocio, type ItemEntrada, registrarEntrada } from "@/lib/servicos/estoque";

export async function salvarEntrada(_: EstadoAcao, fd: FormData) {
  return tentar(async () => {
    const u = await exigirTenant();
    let itens: ItemEntrada[];
    try {
      itens = JSON.parse(String(fd.get("itens") ?? "[]"));
    } catch {
      throw new ErroNegocio("Itens inválidos.");
    }
    const data = texto(fd, "data") ?? hoje();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new ErroNegocio("Data inválida.");
    const db = await getDb();
    const id = await registrarEntrada(db, {
      tenantId: u.tenantId,
      usuarioId: u.id,
      fornecedorId: inteiro(fd, "fornecedorId"),
      notaFiscal: texto(fd, "notaFiscal"),
      data,
      observacao: texto(fd, "observacao"),
      itens: itens.map((i) => ({
        produtoId: Number(i.produtoId),
        quantidade: Number(i.quantidade),
        custoUnitarioCentavos: Math.round(Number(i.custoUnitarioCentavos)),
        validade: i.validade && /^\d{4}-\d{2}-\d{2}$/.test(i.validade) ? i.validade : null,
        codigoLote: i.codigoLote?.trim() || null,
      })),
    });
    if (fd.get("gerarConta") === "1" && u.papel === "ADMIN") {
      const [e] = await db.select().from(entradas).where(eq(entradas.id, id));
      if (e.totalCentavos <= 0) redirect(`/entradas/${id}?ok=1`); // sem valor, não há o que pagar
      const fornecedorId = inteiro(fd, "fornecedorId");
      const parcelas = Number(fd.get("contaParcelas") ?? 1) || 1;
      await criarContasPagar(db, {
        tenantId: u.tenantId,
        usuarioId: u.id,
        descricao: e.notaFiscal ? `Compra NF ${e.notaFiscal}` : `Compra — entrada #${id}`,
        categoriaId: await idCategoriaPorNome(db, u.tenantId, "Fornecedor"),
        fornecedorId,
        entradaId: id,
        documento: e.notaFiscal,
        observacao: null,
        valorCentavos: e.totalCentavos,
        vencimento: texto(fd, "contaVencimento") ?? data,
        modo: parcelas > 1 ? "PARCELADA" : "UNICA",
        vezes: parcelas,
        intervaloDias: Number(fd.get("contaIntervalo") ?? 30) || 30,
      });
    }
    revalidatePath("/entradas");
    revalidatePath("/produtos");
    redirect(`/entradas/${id}?ok=1`);
  });
}
