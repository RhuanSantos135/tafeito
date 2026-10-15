import { and, desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { Cabecalho, Cartao, Indicador, Selo, TabelaRolavel, Vazio } from "@/components/ui";
import { clientes, FORMAS_PAGAMENTO, usuarios, vendas } from "@/db/schema";
import { exigirTenant } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { dataBR, hoje, reais, ROTULO_PAGAMENTO, somarDias } from "@/lib/formato";

export const metadata = { title: "Vendas" };

export default async function Vendas({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string; forma?: string }> }) {
  const u = await exigirTenant();
  const sp = await searchParams;
  const de = sp.de || somarDias(hoje(), -6);
  const ate = sp.ate || hoje();
  const forma = (FORMAS_PAGAMENTO as readonly string[]).includes(sp.forma ?? "") ? (sp.forma as (typeof FORMAS_PAGAMENTO)[number]) : undefined;
  const db = await getDb();
  const diaLocal = sql`date(${vendas.data}, '-3 hours')`;
  const lista = await db
    .select({ v: vendas, cliente: clientes.nome, operador: usuarios.nome })
    .from(vendas)
    .leftJoin(clientes, eq(clientes.id, vendas.clienteId))
    .leftJoin(usuarios, eq(usuarios.id, vendas.usuarioId))
    .where(and(eq(vendas.tenantId, u.tenantId), sql`${diaLocal} between ${de} and ${ate}`, forma ? eq(vendas.formaPagamento, forma) : undefined))
    .orderBy(desc(vendas.data))
    .limit(500);

  const validas = lista.filter((l) => l.v.status === "CONCLUIDA");
  const total = validas.reduce((s, l) => s + l.v.totalCentavos, 0);
  const porForma = FORMAS_PAGAMENTO.map((f) => ({ f, total: validas.filter((l) => l.v.formaPagamento === f).reduce((s, l) => s + l.v.totalCentavos, 0) })).filter((x) => x.total);

  return (
    <>
      <Cabecalho titulo="Vendas" descricao="Histórico de vendas do período." acoes={<Link href="/pdv" className="btn-primario">Abrir PDV</Link>} />
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <label><span className="rotulo">De</span><input type="date" name="de" defaultValue={de} className="campo" /></label>
        <label><span className="rotulo">Até</span><input type="date" name="ate" defaultValue={ate} className="campo" /></label>
        <label>
          <span className="rotulo">Pagamento</span>
          <select name="forma" defaultValue={forma ?? ""} className="campo">
            <option value="">Todos</option>
            {FORMAS_PAGAMENTO.map((f) => <option key={f} value={f}>{ROTULO_PAGAMENTO[f]}</option>)}
          </select>
        </label>
        <button className="btn-secundario">Filtrar</button>
      </form>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Indicador rotulo="Faturamento no período" valor={reais(total)} />
        <Indicador rotulo="Vendas" valor={validas.length} detalhe={`Ticket médio ${reais(validas.length ? Math.round(total / validas.length) : 0)}`} />
        <div className="cartao p-4 text-sm">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-stone-500">Por forma de pagamento</div>
          {porForma.length === 0 ? <span className="text-stone-400">—</span> : porForma.map((x) => (
            <div key={x.f} className="flex justify-between"><span>{ROTULO_PAGAMENTO[x.f]}</span><span className="tabular-nums">{reais(x.total)}</span></div>
          ))}
        </div>
      </div>
      <Cartao>
        {lista.length === 0 ? (
          <Vazio>Nenhuma venda no período.</Vazio>
        ) : (
          <TabelaRolavel>
            <table className="tabela">
              <thead>
                <tr><th>#</th><th>Data</th><th>Cliente</th><th>Pagamento</th><th>Operador</th><th className="text-right">Total</th></tr>
              </thead>
              <tbody>
                {lista.map(({ v, cliente, operador }) => (
                  <tr key={v.id} className={v.status === "CANCELADA" ? "opacity-50" : ""}>
                    <td><Link href={`/vendas/${v.id}`} className="link">#{v.id}</Link></td>
                    <td className="whitespace-nowrap">{dataBR(v.data)}</td>
                    <td>{cliente ?? "—"}</td>
                    <td>{v.formaPagamento === "PRAZO" ? <Selo tom="amarelo">Fiado</Selo> : ROTULO_PAGAMENTO[v.formaPagamento]}</td>
                    <td>{operador ?? "—"}</td>
                    <td className="text-right font-medium tabular-nums">{v.status === "CANCELADA" ? <Selo tom="vermelho">cancelada</Selo> : reais(v.totalCentavos)}</td>
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
