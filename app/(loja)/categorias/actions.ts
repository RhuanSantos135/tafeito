"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { EstadoAcao } from "@/components/formulario";
import { categorias, produtos } from "@/db/schema";
import { inteiro, tentar, texto } from "@/lib/acao";
import { exigirTenant } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ErroNegocio } from "@/lib/servicos/estoque";

export async function salvarCategoria(_: EstadoAcao, fd: FormData) {
  return tentar(async () => {
    const u = await exigirTenant();
    const nome = texto(fd, "nome");
    if (!nome) throw new ErroNegocio("Informe o nome.");
    const db = await getDb();
    const id = inteiro(fd, "id");
    if (id) await db.update(categorias).set({ nome }).where(and(eq(categorias.id, id), eq(categorias.tenantId, u.tenantId)));
    else await db.insert(categorias).values({ tenantId: u.tenantId, nome });
    revalidatePath("/categorias");
    return { ok: "Categoria salva.", t: Date.now() };
  });
}

export async function excluirCategoria(_: EstadoAcao, fd: FormData) {
  return tentar(async () => {
    const u = await exigirTenant();
    const id = inteiro(fd, "id");
    if (!id) throw new ErroNegocio("Categoria inválida.");
    const db = await getDb();
    const [uso] = await db.select({ id: produtos.id }).from(produtos).where(and(eq(produtos.categoriaId, id), eq(produtos.tenantId, u.tenantId))).limit(1);
    if (uso) throw new ErroNegocio("Há produtos nesta categoria. Mova-os antes de excluir.");
    await db.delete(categorias).where(and(eq(categorias.id, id), eq(categorias.tenantId, u.tenantId)));
    revalidatePath("/categorias");
    return { ok: "Categoria excluída.", t: Date.now() };
  });
}
