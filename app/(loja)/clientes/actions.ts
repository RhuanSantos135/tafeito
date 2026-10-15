"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoAcao } from "@/components/formulario";
import { clientes } from "@/db/schema";
import { inteiro, tentar, texto } from "@/lib/acao";
import { exigirTenant } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { paraCentavos, reais } from "@/lib/formato";
import { ErroNegocio } from "@/lib/servicos/estoque";
import { receberPagamento } from "@/lib/servicos/vendas";

export async function salvarCliente(_: EstadoAcao, fd: FormData) {
  return tentar(async () => {
    const u = await exigirTenant();
    const nome = texto(fd, "nome");
    if (!nome) throw new ErroNegocio("Informe o nome.");
    const dias = Number(fd.get("diasPrazo") ?? 30);
    const dados = {
      nome,
      telefone: texto(fd, "telefone"),
      cpf: texto(fd, "cpf"),
      limiteCreditoCentavos: paraCentavos(fd.get("limite")),
      diasPrazo: Number.isInteger(dias) && dias > 0 && dias <= 365 ? dias : 30,
      ativo: fd.get("ativo") !== "0",
    };
    const db = await getDb();
    const id = inteiro(fd, "id");
    if (id) {
      await db.update(clientes).set(dados).where(and(eq(clientes.id, id), eq(clientes.tenantId, u.tenantId)));
      revalidatePath(`/clientes/${id}`);
      return { ok: "Cliente atualizado.", t: Date.now() };
    }
    const [novo] = await db.insert(clientes).values({ ...dados, tenantId: u.tenantId }).returning({ id: clientes.id });
    revalidatePath("/clientes");
    redirect(`/clientes/${novo.id}`);
  });
}

export async function registrarPagamento(_: EstadoAcao, fd: FormData) {
  return tentar(async () => {
    const u = await exigirTenant();
    const clienteId = inteiro(fd, "clienteId");
    if (!clienteId) throw new ErroNegocio("Cliente inválido.");
    const forma = String(fd.get("forma")) as "DINHEIRO" | "PIX" | "DEBITO" | "CREDITO";
    if (!["DINHEIRO", "PIX", "DEBITO", "CREDITO"].includes(forma)) throw new ErroNegocio("Forma de pagamento inválida.");
    const valor = paraCentavos(fd.get("valor"));
    const db = await getDb();
    await receberPagamento(db, { tenantId: u.tenantId, usuarioId: u.id, clienteId, valorCentavos: valor, forma, contaId: inteiro(fd, "contaId") ?? undefined });
    revalidatePath("/", "layout");
    return { ok: `Pagamento de ${reais(valor)} registrado.`, t: Date.now() };
  });
}
