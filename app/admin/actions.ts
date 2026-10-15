"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoAcao } from "@/components/formulario";
import { faturas, sessoes, tenants, usuarios } from "@/db/schema";
import { inteiro, tentar, texto } from "@/lib/acao";
import { exigirSuperAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { hoje, paraCentavos, slugify } from "@/lib/formato";
import { gerarHashSenha, verificarSenha } from "@/lib/senha";
import { ErroNegocio } from "@/lib/servicos/estoque";
import { gerarFaturas, salvarConfig } from "@/lib/servicos/plataforma";

export async function criarTenant(_: EstadoAcao, fd: FormData) {
  return tentar(async () => {
    await exigirSuperAdmin();
    const nome = texto(fd, "nome");
    const adminNome = texto(fd, "adminNome");
    const adminEmail = texto(fd, "adminEmail")?.toLowerCase();
    const senha = String(fd.get("adminSenha") ?? "");
    if (!nome || !adminNome || !adminEmail) throw new ErroNegocio("Preencha nome da mercearia e dados do administrador.");
    if (senha.length < 6) throw new ErroNegocio("A senha deve ter ao menos 6 caracteres.");
    const slug = slugify(texto(fd, "slug") ?? nome);
    if (!slug) throw new ErroNegocio("Identificador inválido.");

    const db = await getDb();
    const [existe] = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.email, adminEmail));
    if (existe) throw new ErroNegocio("Já existe um usuário com esse e-mail.");
    const [t] = await db
      .insert(tenants)
      .values({ nome, slug, documento: texto(fd, "documento"), email: texto(fd, "email") ?? adminEmail, telefone: texto(fd, "telefone") })
      .returning({ id: tenants.id });
    try {
      await db.insert(usuarios).values({ tenantId: t.id, nome: adminNome, email: adminEmail, papel: "ADMIN", senhaHash: await gerarHashSenha(senha) });
    } catch (e) {
      await db.delete(tenants).where(eq(tenants.id, t.id));
      throw e;
    }
    revalidatePath("/admin");
    redirect(`/admin/clientes/${t.id}?criado=1`);
  });
}

export async function atualizarTenant(_: EstadoAcao, fd: FormData) {
  return tentar(async () => {
    await exigirSuperAdmin();
    const id = inteiro(fd, "id");
    const nome = texto(fd, "nome");
    if (!id || !nome) throw new ErroNegocio("Dados inválidos.");
    const base = texto(fd, "valorBase");
    const porMb = texto(fd, "valorPorMb");
    const ativo = fd.get("ativo") !== "0";
    const db = await getDb();
    await db
      .update(tenants)
      .set({
        nome,
        slug: slugify(texto(fd, "slug") ?? nome),
        documento: texto(fd, "documento"),
        email: texto(fd, "email"),
        telefone: texto(fd, "telefone"),
        ativo,
        valorBaseCentavos: base ? paraCentavos(base) : null,
        valorPorMbCentavos: porMb ? paraCentavos(porMb) : null,
      })
      .where(eq(tenants.id, id));
    if (!ativo) {
      // Suspensão derruba as sessões abertas da mercearia
      const us = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.tenantId, id));
      for (const u of us) await db.delete(sessoes).where(eq(sessoes.usuarioId, u.id));
    }
    revalidatePath("/admin", "layout");
    return { ok: ativo ? "Mercearia atualizada." : "Mercearia suspensa: os usuários foram desconectados.", t: Date.now() };
  });
}

export async function gerarFaturasAcao(_: EstadoAcao, fd: FormData) {
  return tentar(async () => {
    await exigirSuperAdmin();
    const competencia = String(fd.get("competencia") ?? "");
    if (!/^\d{4}-\d{2}$/.test(competencia)) throw new ErroNegocio("Competência inválida (use AAAA-MM).");
    const db = await getDb();
    const n = await gerarFaturas(db, competencia);
    revalidatePath("/admin", "layout");
    return { ok: `${n} fatura(s) geradas/recalculadas para ${competencia}. Faturas já pagas não foram alteradas.`, t: Date.now() };
  });
}

export async function alterarStatusFatura(_: EstadoAcao, fd: FormData) {
  return tentar(async () => {
    await exigirSuperAdmin();
    const id = inteiro(fd, "id");
    const status = String(fd.get("status"));
    if (!id || !["ABERTA", "PAGA", "CANCELADA"].includes(status)) throw new ErroNegocio("Dados inválidos.");
    const db = await getDb();
    await db
      .update(faturas)
      .set({ status: status as "ABERTA" | "PAGA" | "CANCELADA", pagaEm: status === "PAGA" ? hoje() : null })
      .where(eq(faturas.id, id));
    revalidatePath("/admin", "layout");
    return { ok: "Fatura atualizada.", t: Date.now() };
  });
}

export async function salvarConfigAcao(_: EstadoAcao, fd: FormData) {
  return tentar(async () => {
    await exigirSuperAdmin();
    const dia = Number(fd.get("diaVencimento"));
    if (!Number.isInteger(dia) || dia < 1 || dia > 28) throw new ErroNegocio("Dia de vencimento deve ser entre 1 e 28.");
    const db = await getDb();
    await salvarConfig(db, { valorBaseCentavos: paraCentavos(fd.get("valorBase")), valorPorMbCentavos: paraCentavos(fd.get("valorPorMb")), diaVencimento: dia });
    revalidatePath("/admin", "layout");
    return { ok: "Preços salvos.", t: Date.now() };
  });
}

export async function trocarSenhaAdmin(_: EstadoAcao, fd: FormData) {
  return tentar(async () => {
    const u = await exigirSuperAdmin();
    const atual = String(fd.get("atual") ?? "");
    const nova = String(fd.get("nova") ?? "");
    if (nova.length < 8) throw new ErroNegocio("A nova senha deve ter ao menos 8 caracteres.");
    const db = await getDb();
    const [linha] = await db.select({ h: usuarios.senhaHash }).from(usuarios).where(eq(usuarios.id, u.id));
    if (!(await verificarSenha(atual, linha.h))) throw new ErroNegocio("Senha atual incorreta.");
    await db.update(usuarios).set({ senhaHash: await gerarHashSenha(nova) }).where(and(eq(usuarios.id, u.id), eq(usuarios.papel, "SUPERADMIN")));
    return { ok: "Senha alterada.", t: Date.now() };
  });
}
