import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/lib/db";

/** Atividade por mercearia: usuários, sessões ativas, último login e última venda. */
export async function atividadeTenants(db: Db) {
  const agora = new Date().toISOString();
  const linhas = await db.all<{ tenant_id: number; usuarios: number; sessoes_ativas: number; ultimo_login: string | null; ultima_venda: string | null; vendas_30d: number }>(sql`
    select t.id as tenant_id,
      (select count(*) from usuarios u where u.tenant_id = t.id and u.ativo = 1) as usuarios,
      (select count(*) from sessoes s join usuarios u on u.id = s.usuario_id where u.tenant_id = t.id and s.expira_em > ${agora}) as sessoes_ativas,
      (select max(s.criado_em) from sessoes s join usuarios u on u.id = s.usuario_id where u.tenant_id = t.id) as ultimo_login,
      (select max(v.data) from vendas v where v.tenant_id = t.id) as ultima_venda,
      (select count(*) from vendas v where v.tenant_id = t.id and v.data >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 days')) as vendas_30d
    from tenants t
  `);
  return new Map(linhas.map((l) => [l.tenant_id, l]));
}
