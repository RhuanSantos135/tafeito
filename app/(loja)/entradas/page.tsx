import { count, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Cabecalho, Cartao, TabelaRolavel, Vazio } from "@/components/ui";
import { entradas, fornecedores, lotes } from "@/db/schema";
import { exigirTenant } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { dataBR, reais } from "@/lib/formato";

export const metadata = { title: "Entradas" };

export default async function Entradas() {
  const u = await exigirTenant();
  const db = await getDb();
  const lista = await db
    .select({ e: entradas, fornecedor: fornecedores.nome, itens: count(lotes.id) })
    .from(entradas)
    .leftJoin(fornecedores, eq(fornecedores.id, entradas.fornecedorId))
    .leftJoin(lotes, eq(lotes.entradaId, entradas.id))
    .where(eq(entradas.tenantId, u.tenantId))
    .groupBy(entradas.id)
    .orderBy(desc(entradas.data), desc(entradas.id))
    .limit(200);

  return (
    <>
      <Cabecalho titulo="Entradas" descricao="Compras e reposições recebidas dos fornecedores." acoes={<Link href="/entradas/nova" className="btn-primario">+ Nova entrada</Link>} />
      <Cartao>
        {lista.length === 0 ? (
          <Vazio>Nenhuma entrada registrada.</Vazio>
        ) : (
          <TabelaRolavel>
            <table className="tabela">
              <thead>
                <tr><th>#</th><th>Data</th><th>Fornecedor</th><th>Nota fiscal</th><th className="text-right">Itens</th><th className="text-right">Total</th></tr>
              </thead>
              <tbody>
                {lista.map(({ e, fornecedor, itens }) => (
                  <tr key={e.id}>
                    <td><Link href={`/entradas/${e.id}`} className="link">#{e.id}</Link></td>
                    <td>{dataBR(e.data)}</td>
                    <td>{fornecedor ?? "—"}</td>
                    <td>{e.notaFiscal ?? "—"}</td>
                    <td className="text-right tabular-nums">{itens}</td>
                    <td className="text-right tabular-nums font-medium">{reais(e.totalCentavos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRolavel>
        )}
      </Cartao>
    </>
  );
}
