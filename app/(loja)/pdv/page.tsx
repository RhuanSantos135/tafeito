import { and, asc, eq } from "drizzle-orm";
import { clientes, produtos } from "@/db/schema";
import { exigirTenant } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { saldos } from "@/lib/servicos/estoque";
import { Caixa } from "./caixa";

export const metadata = { title: "PDV" };

export default async function Pdv() {
  const u = await exigirTenant();
  const db = await getDb();
  const [prods, clis, mapa] = await Promise.all([
    db
      .select({ id: produtos.id, nome: produtos.nome, codigoBarras: produtos.codigoBarras, unidade: produtos.unidade, preco: produtos.precoVendaCentavos })
      .from(produtos)
      .where(and(eq(produtos.tenantId, u.tenantId), eq(produtos.ativo, true)))
      .orderBy(asc(produtos.nome)),
    db
      .select({ id: clientes.id, nome: clientes.nome, telefone: clientes.telefone })
      .from(clientes)
      .where(and(eq(clientes.tenantId, u.tenantId), eq(clientes.ativo, true)))
      .orderBy(asc(clientes.nome)),
    saldos(db, u.tenantId),
  ]);
  return <Caixa produtos={prods.map((p) => ({ ...p, saldo: mapa.get(p.id) ?? 0 }))} clientes={clis} />;
}
