"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoAcao } from "@/components/formulario";
import { produtos } from "@/db/schema";
import { inteiro, tentar, texto } from "@/lib/acao";
import { exigirTenant } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { paraCentavos, paraNumero } from "@/lib/formato";
import { ErroNegocio } from "@/lib/servicos/estoque";

const UNIDADES = ["UN", "KG", "CX", "LT", "PCT"] as const;

export async function salvarProduto(_: EstadoAcao, fd: FormData) {
  return tentar(async () => {
    const u = await exigirTenant();
    const nome = texto(fd, "nome");
    if (!nome) throw new ErroNegocio("Informe o nome do produto.");
    const unidade = String(fd.get("unidade")) as (typeof UNIDADES)[number];
    if (!UNIDADES.includes(unidade)) throw new ErroNegocio("Unidade inválida.");
    const precoVenda = paraCentavos(fd.get("precoVenda"));
    if (precoVenda <= 0) throw new ErroNegocio("Informe o preço de venda.");

    const dados = {
      nome,
      codigoBarras: texto(fd, "codigoBarras"),
      categoriaId: inteiro(fd, "categoriaId"),
      unidade,
      precoCustoCentavos: paraCentavos(fd.get("precoCusto")),
      precoVendaCentavos: precoVenda,
      estoqueMinimo: Math.max(0, paraNumero(fd.get("estoqueMinimo"))),
      ativo: fd.get("ativo") !== "0",
    };
    const db = await getDb();
    const id = inteiro(fd, "id");
    if (id) {
      await db.update(produtos).set(dados).where(and(eq(produtos.id, id), eq(produtos.tenantId, u.tenantId)));
    } else {
      await db.insert(produtos).values({ ...dados, tenantId: u.tenantId });
    }
    revalidatePath("/produtos");
    if (id) return { ok: "Produto atualizado.", t: Date.now() };
    redirect("/produtos?criado=1");
  });
}
