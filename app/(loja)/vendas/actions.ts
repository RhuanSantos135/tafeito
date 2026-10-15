"use server";

import { revalidatePath } from "next/cache";
import type { EstadoAcao } from "@/components/formulario";
import { inteiro, tentar } from "@/lib/acao";
import { exigirTenant } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ErroNegocio } from "@/lib/servicos/estoque";
import { cancelarVenda } from "@/lib/servicos/vendas";

export async function cancelar(_: EstadoAcao, fd: FormData) {
  return tentar(async () => {
    const u = await exigirTenant({ admin: true });
    const id = inteiro(fd, "id");
    if (!id) throw new ErroNegocio("Venda inválida.");
    const db = await getDb();
    await cancelarVenda(db, u.tenantId, u.id, id);
    revalidatePath("/", "layout");
    return { ok: "Venda cancelada e estoque devolvido.", t: Date.now() };
  });
}
