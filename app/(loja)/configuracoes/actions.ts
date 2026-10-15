"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { EstadoAcao } from "@/components/formulario";
import { tenants } from "@/db/schema";
import { tentar, texto } from "@/lib/acao";
import { exigirTenant } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ErroNegocio } from "@/lib/servicos/estoque";

export async function salvarDadosLoja(_: EstadoAcao, fd: FormData) {
  return tentar(async () => {
    const u = await exigirTenant({ admin: true });
    const nome = texto(fd, "nome");
    if (!nome) throw new ErroNegocio("Informe o nome da mercearia.");
    const db = await getDb();
    await db
      .update(tenants)
      .set({ nome, documento: texto(fd, "documento"), telefone: texto(fd, "telefone"), email: texto(fd, "email") })
      .where(eq(tenants.id, u.tenantId));
    revalidatePath("/", "layout");
    return { ok: "Dados salvos.", t: Date.now() };
  });
}
