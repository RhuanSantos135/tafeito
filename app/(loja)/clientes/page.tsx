import { and, asc, eq, like, sql } from "drizzle-orm";
import Link from "next/link";
import { Cabecalho, Cartao, Selo, TabelaRolavel, Vazio } from "@/components/ui";
import { clientes } from "@/db/schema";
import { exigirTenant } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { hoje, reais } from "@/lib/formato";
import { FormCliente } from "./form-cliente";

export const metadata = { title: "Clientes" };

export default async function Clientes({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const u = await exigirTenant();
  const { q } = await searchParams;
  const db = await getDb();
  const hj = hoje();
  const lista = await db
    .select({
      c: clientes,
      devedor: sql<number>`coalesce((select sum(valor_centavos - valor_pago_centavos) from contas_receber cr where cr.cliente_id = ${clientes.id} and cr.status = 'ABERTA'), 0)`,
      vencido: sql<number>`coalesce((select sum(valor_centavos - valor_pago_centavos) from contas_receber cr where cr.cliente_id = ${clientes.id} and cr.status = 'ABERTA' and cr.vencimento < ${hj}), 0)`,
    })
    .from(clientes)
    .where(and(eq(clientes.tenantId, u.tenantId), q ? like(clientes.nome, `%${q}%`) : undefined))
    .orderBy(asc(clientes.nome));

  return (
    <>
      <Cabecalho titulo="Clientes" descricao="Cadastro, limite de crédito e saldo do fiado." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Cartao titulo="Novo cliente">
          <FormCliente />
        </Cartao>
        <div className="lg:col-span-2">
          <form className="mb-3 flex gap-2">
            <input name="q" defaultValue={q} placeholder="Buscar cliente" className="campo" />
            <button className="btn-secundario">Buscar</button>
          </form>
          <Cartao>
            {lista.length === 0 ? (
              <Vazio>Nenhum cliente.</Vazio>
            ) : (
              <TabelaRolavel>
                <table className="tabela">
                  <thead>
                    <tr><th>Cliente</th><th className="text-right">Limite</th><th className="text-right">Devendo</th><th /></tr>
                  </thead>
                  <tbody>
                    {lista.map(({ c, devedor, vencido }) => (
                      <tr key={c.id} className={c.ativo ? "" : "opacity-50"}>
                        <td>
                          <Link href={`/clientes/${c.id}`} className="font-medium hover:underline">{c.nome}</Link>
                          <div className="text-xs text-stone-400">{c.telefone}</div>
                        </td>
                        <td className="text-right tabular-nums">{reais(c.limiteCreditoCentavos)}</td>
                        <td className="text-right tabular-nums font-medium">{reais(devedor)}</td>
                        <td className="text-right">
                          {vencido > 0 ? <Selo tom="vermelho">vencido {reais(vencido)}</Selo> : devedor >= c.limiteCreditoCentavos && devedor > 0 ? <Selo tom="amarelo">limite esgotado</Selo> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TabelaRolavel>
            )}
          </Cartao>
        </div>
      </div>
    </>
  );
}
