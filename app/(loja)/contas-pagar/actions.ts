"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoAcao } from "@/components/formulario";
import { categoriasDespesa, contasPagar } from "@/db/schema";
import { inteiro, tentar, texto } from "@/lib/acao";
import { exigirTenant } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { hoje, paraCentavos, reais } from "@/lib/formato";
import { cancelarContaPagar, criarContasPagar, type FormaPagar, pagarConta } from "@/lib/servicos/contas-pagar";
import { ErroNegocio } from "@/lib/servicos/estoque";

function voltarComAviso(fd: FormData, aviso: string): never {
  const volta = String(fd.get("volta") ?? "");
  const destino = volta.startsWith("/contas-pagar") ? volta : "/contas-pagar";
  redirect(`${destino}${destino.includes("?") ? "&" : "?"}${aviso}`);
}

export async function salvarContaPagar(_: EstadoAcao, fd: FormData) {
  return tentar(async () => {
    const u = await exigirTenant({ admin: true });
    const modo = String(fd.get("modo") ?? "UNICA") as "UNICA" | "MENSAL" | "PARCELADA";
    if (!["UNICA", "MENSAL", "PARCELADA"].includes(modo)) throw new ErroNegocio("Opção de repetição inválida.");
    const db = await getDb();
    const n = await criarContasPagar(db, {
      tenantId: u.tenantId,
      usuarioId: u.id,
      descricao: texto(fd, "descricao") ?? "",
      categoriaId: inteiro(fd, "categoriaId"),
      fornecedorId: inteiro(fd, "fornecedorId"),
      documento: texto(fd, "documento"),
      observacao: texto(fd, "observacao"),
      valorCentavos: paraCentavos(fd.get("valor")),
      vencimento: texto(fd, "vencimento") ?? "",
      modo,
      vezes: Number(fd.get("vezes") ?? 1),
    });
    revalidatePath("/", "layout");
    return { ok: n > 1 ? `${n} contas lançadas.` : "Conta lançada.", t: Date.now() };
  });
}

export async function pagarContaAcao(_: EstadoAcao, fd: FormData) {
  return tentar(async () => {
    const u = await exigirTenant({ admin: true });
    const contaId = inteiro(fd, "id");
    if (!contaId) throw new ErroNegocio("Conta inválida.");
    const valor = paraCentavos(fd.get("valor"));
    const db = await getDb();
    const r = await pagarConta(db, {
      tenantId: u.tenantId,
      usuarioId: u.id,
      contaId,
      valorCentavos: valor,
      forma: String(fd.get("forma")) as FormaPagar,
      data: texto(fd, "data") ?? hoje(),
    });
    revalidatePath("/", "layout");
    // A conta sai da lista "em aberto" junto com o formulário; o aviso vai para o topo da página
    if (r.quitada) voltarComAviso(fd, `quitada=${contaId}`);
    return { ok: `Pagamento de ${reais(valor)} registrado.`, t: Date.now() };
  });
}

export async function cancelarContaAcao(_: EstadoAcao, fd: FormData) {
  return tentar(async () => {
    const u = await exigirTenant({ admin: true });
    const id = inteiro(fd, "id");
    if (!id) throw new ErroNegocio("Conta inválida.");
    const db = await getDb();
    const n = await cancelarContaPagar(db, u.tenantId, id, fd.get("seguintes") === "1");
    revalidatePath("/", "layout");
    voltarComAviso(fd, `canceladas=${n}`);
  });
}

export async function salvarCategoriaDespesa(_: EstadoAcao, fd: FormData) {
  return tentar(async () => {
    const u = await exigirTenant({ admin: true });
    const nome = texto(fd, "nome");
    if (!nome) throw new ErroNegocio("Informe o nome da categoria.");
    const db = await getDb();
    const id = inteiro(fd, "id");
    if (id) await db.update(categoriasDespesa).set({ nome }).where(and(eq(categoriasDespesa.id, id), eq(categoriasDespesa.tenantId, u.tenantId)));
    else await db.insert(categoriasDespesa).values({ tenantId: u.tenantId, nome });
    revalidatePath("/contas-pagar");
    return { ok: "Categoria salva.", t: Date.now() };
  });
}

export async function excluirCategoriaDespesa(_: EstadoAcao, fd: FormData) {
  return tentar(async () => {
    const u = await exigirTenant({ admin: true });
    const id = inteiro(fd, "id");
    if (!id) throw new ErroNegocio("Categoria inválida.");
    const db = await getDb();
    const [uso] = await db.select({ id: contasPagar.id }).from(contasPagar).where(and(eq(contasPagar.categoriaId, id), eq(contasPagar.tenantId, u.tenantId))).limit(1);
    if (uso) throw new ErroNegocio("Há contas nesta categoria; ela não pode ser excluída.");
    await db.delete(categoriasDespesa).where(and(eq(categoriasDespesa.id, id), eq(categoriasDespesa.tenantId, u.tenantId)));
    revalidatePath("/contas-pagar");
    return { ok: "Categoria excluída.", t: Date.now() };
  });
}
