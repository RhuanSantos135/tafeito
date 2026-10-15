"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { EstadoAcao } from "@/components/formulario";
import { fornecedores } from "@/db/schema";
import { inteiro, tentar, texto } from "@/lib/acao";
import { exigirTenant } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ErroNegocio } from "@/lib/servicos/estoque";

export async function salvarFornecedor(_: EstadoAcao, fd: FormData) {
  return tentar(async () => {
    const u = await exigirTenant();
    const nome = texto(fd, "nome");
    if (!nome) throw new ErroNegocio("Informe o nome.");
    const dados = { nome, documento: texto(fd, "documento"), telefone: texto(fd, "telefone") };
    const db = await getDb();
    const id = inteiro(fd, "id");
    if (id) await db.update(fornecedores).set(dados).where(and(eq(fornecedores.id, id), eq(fornecedores.tenantId, u.tenantId)));
    else await db.insert(fornecedores).values({ ...dados, tenantId: u.tenantId });
    revalidatePath("/fornecedores");
    return { ok: "Fornecedor salvo.", t: Date.now() };
  });
}
