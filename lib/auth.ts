import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { sessoes, tenants, usuarios } from "@/db/schema";
import { getDb } from "@/lib/db";

const COOKIE = "tafeito_sessao";
const DURACAO_DIAS = 30;

export async function criarSessao(usuarioId: number) {
  const db = await getDb();
  const id = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
  const expira = new Date(Date.now() + DURACAO_DIAS * 86_400_000);
  await db.insert(sessoes).values({ id, usuarioId, expiraEm: expira.toISOString() });
  (await cookies()).set(COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expira,
  });
}

export async function encerrarSessao() {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (id) {
    const db = await getDb();
    await db.delete(sessoes).where(eq(sessoes.id, id));
  }
  jar.delete(COOKIE);
}

export type UsuarioSessao = {
  id: number;
  nome: string;
  email: string;
  papel: "SUPERADMIN" | "ADMIN" | "OPERADOR";
  tenantId: number | null;
};

export const usuarioAtual = cache(async (): Promise<UsuarioSessao | null> => {
  const id = (await cookies()).get(COOKIE)?.value;
  if (!id) return null;
  const db = await getDb();
  const [linha] = await db
    .select({
      id: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      papel: usuarios.papel,
      tenantId: usuarios.tenantId,
      tenantAtivo: tenants.ativo,
    })
    .from(sessoes)
    .innerJoin(usuarios, eq(usuarios.id, sessoes.usuarioId))
    .leftJoin(tenants, eq(tenants.id, usuarios.tenantId))
    .where(and(eq(sessoes.id, id), gt(sessoes.expiraEm, new Date().toISOString()), eq(usuarios.ativo, true)))
    .limit(1);
  if (!linha) return null;
  if (linha.papel !== "SUPERADMIN" && !linha.tenantAtivo) return null;
  const { tenantAtivo: _, ...u } = linha;
  return u;
});

/** Exige usuário de uma mercearia. Retorna o usuário com tenantId garantido. */
export async function exigirTenant(opts?: { admin?: boolean }) {
  const u = await usuarioAtual();
  if (!u) redirect("/login");
  if (u.papel === "SUPERADMIN" || u.tenantId == null) redirect("/admin");
  if (opts?.admin && u.papel !== "ADMIN") redirect("/");
  return { ...u, tenantId: u.tenantId };
}

export async function exigirSuperAdmin() {
  const u = await usuarioAtual();
  if (!u) redirect("/login");
  if (u.papel !== "SUPERADMIN") redirect("/");
  return u;
}
