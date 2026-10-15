import "server-only";
import { eq, getTableColumns, getTableName, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { configuracoes, faturas, TABELAS_TENANT, tenants, usuarios } from "@/db/schema";
import type { Db } from "@/lib/db";

// Overhead aproximado por linha no SQLite (cabeçalho do registro + entradas de índice)
const OVERHEAD_LINHA = 40;

export type UsoTenant = { tenantId: number; bytes: number; linhas: number; porTabela: Record<string, { linhas: number; bytes: number }> };

function somaColunas(tabela: SQLiteTable) {
  const nomes = Object.values(getTableColumns(tabela)).map((c) => `coalesce(length("${c.name}"), 0)`);
  return nomes.join(" + ");
}

/**
 * Estima o armazenamento ocupado por cada mercearia no D1.
 * O D1 não expõe tamanho por linha, então somamos o comprimento de cada coluna + overhead por linha.
 */
export async function usoArmazenamento(db: Db): Promise<Map<number, UsoTenant>> {
  const tabelas: [string, SQLiteTable][] = [
    ...Object.values(TABELAS_TENANT).map((t) => [getTableName(t), t] as [string, SQLiteTable]),
    ["usuarios", usuarios],
  ];
  const consultas = tabelas.map(
    ([nome, t]) =>
      `select '${nome}' as tabela, tenant_id, count(*) as linhas, sum(${somaColunas(t)}) as bytes from "${nome}" where tenant_id is not null group by tenant_id`,
  );
  consultas.push(`select 'tenants' as tabela, id as tenant_id, 1 as linhas, ${somaColunas(tenants)} as bytes from tenants`);

  // O D1 limita termos em UNION, então cada tabela vira uma consulta (executadas em paralelo)
  type Linha = { tabela: string; tenant_id: number; linhas: number; bytes: number };
  const linhas = (await Promise.all(consultas.map((q) => db.all<Linha>(sql.raw(q))))).flat();

  const mapa = new Map<number, UsoTenant>();
  for (const l of linhas) {
    const u = mapa.get(l.tenant_id) ?? { tenantId: l.tenant_id, bytes: 0, linhas: 0, porTabela: {} };
    const b = (l.bytes ?? 0) + l.linhas * OVERHEAD_LINHA;
    u.bytes += b;
    u.linhas += l.linhas;
    u.porTabela[l.tabela] = { linhas: l.linhas, bytes: b };
    mapa.set(l.tenant_id, u);
  }
  return mapa;
}

export const CONFIG_PADRAO = {
  valorBaseCentavos: 4990, // mensalidade base
  valorPorMbCentavos: 50, // por MB armazenado
  diaVencimento: 10,
};

export type ConfigPlataforma = typeof CONFIG_PADRAO;

export async function lerConfig(db: Db): Promise<ConfigPlataforma> {
  const linhas = await db.select().from(configuracoes);
  const cfg = { ...CONFIG_PADRAO };
  for (const l of linhas) if (l.chave in cfg) cfg[l.chave as keyof ConfigPlataforma] = Number(l.valor);
  return cfg;
}

export async function salvarConfig(db: Db, cfg: ConfigPlataforma) {
  const stmts: BatchItem<"sqlite">[] = Object.entries(cfg).map(([chave, valor]) =>
    db
      .insert(configuracoes)
      .values({ chave, valor: String(valor) })
      .onConflictDoUpdate({ target: configuracoes.chave, set: { valor: String(valor) } }),
  );
  await db.batch(stmts as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
}

export function calcularFatura(bytes: number, cfg: ConfigPlataforma, tenant: { valorBaseCentavos: number | null; valorPorMbCentavos: number | null }) {
  const base = tenant.valorBaseCentavos ?? cfg.valorBaseCentavos;
  const porMb = tenant.valorPorMbCentavos ?? cfg.valorPorMbCentavos;
  const mb = Math.ceil(bytes / (1024 * 1024));
  const armazenamento = mb * porMb;
  return { base, armazenamento, total: base + armazenamento, mb };
}

/** Gera (ou recalcula, se ainda ABERTA) a fatura da competência para todas as mercearias ativas. */
export async function gerarFaturas(db: Db, competencia: string) {
  const cfg = await lerConfig(db);
  const uso = await usoArmazenamento(db);
  const ativos = await db.select().from(tenants).where(eq(tenants.ativo, true));
  const [ano, mes] = competencia.split("-").map(Number);
  const prox = new Date(Date.UTC(ano, mes, cfg.diaVencimento));
  const vencimento = prox.toISOString().slice(0, 10);

  let geradas = 0;
  for (const t of ativos) {
    const bytes = uso.get(t.id)?.bytes ?? 0;
    const f = calcularFatura(bytes, cfg, t);
    const res = await db
      .insert(faturas)
      .values({
        tenantId: t.id,
        competencia,
        armazenamentoBytes: bytes,
        valorBaseCentavos: f.base,
        valorArmazenamentoCentavos: f.armazenamento,
        totalCentavos: f.total,
        vencimento,
      })
      .onConflictDoUpdate({
        target: [faturas.tenantId, faturas.competencia],
        set: { armazenamentoBytes: bytes, valorBaseCentavos: f.base, valorArmazenamentoCentavos: f.armazenamento, totalCentavos: f.total, vencimento },
        setWhere: sql`${faturas.status} = 'ABERTA'`,
      })
      .returning({ id: faturas.id });
    geradas += res.length;
  }
  return geradas;
}
