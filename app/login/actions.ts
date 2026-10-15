"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { EstadoAcao } from "@/components/formulario";
import { tenants, usuarios } from "@/db/schema";
import { criarSessao, encerrarSessao } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { verificarSenha } from "@/lib/senha";

export async function entrar(_: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const senha = String(fd.get("senha") ?? "");
  if (!email || !senha) return { erro: "Informe e-mail e senha." };

  const db = await getDb();
  const [u] = await db
    .select({ id: usuarios.id, senhaHash: usuarios.senhaHash, papel: usuarios.papel, ativo: usuarios.ativo, tenantAtivo: tenants.ativo })
    .from(usuarios)
    .leftJoin(tenants, eq(tenants.id, usuarios.tenantId))
    .where(eq(usuarios.email, email));

  if (!u || !u.ativo || !(await verificarSenha(senha, u.senhaHash))) return { erro: "E-mail ou senha inválidos." };
  if (u.papel !== "SUPERADMIN" && !u.tenantAtivo) return { erro: "Acesso suspenso. Fale com o suporte do Tá Feito." };

  await criarSessao(u.id);
  redirect(u.papel === "SUPERADMIN" ? "/admin" : "/");
}

export async function sair() {
  await encerrarSessao();
  redirect("/login");
}
