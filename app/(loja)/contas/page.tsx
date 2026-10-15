import Link from "next/link";
import { Abas, Cabecalho, Cartao, Indicador, Selo, TabelaRolavel, Vazio } from "@/components/ui";
import { exigirTenant } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { dataBR, dias, diasEntre, hoje, reais } from "@/lib/formato";
import { contasAReceber, resumoFiado } from "@/lib/servicos/relatorios";

export const metadata = { title: "Contas a receber" };

export default async function Contas({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const u = await exigirTenant();
  const { f } = await searchParams;
  const filtro = f === "vencidas" || f === "a_vencer" ? f : "todas";
  const db = await getDb();
  const [lista, resumo] = await Promise.all([contasAReceber(db, u.tenantId, filtro), resumoFiado(db, u.tenantId)]);
  const hj = hoje();

  return (
    <>
      <Cabecalho titulo="Contas a receber" descricao="Fiado em aberto. Para receber, abra a ficha do cliente." />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Indicador rotulo="Total a receber" valor={reais(resumo.aberto)} />
        <Indicador rotulo="Vencido" valor={reais(resumo.vencido)} tom={resumo.vencido ? "perigo" : "ok"} />
        <Indicador rotulo="Vence em 7 dias" valor={reais(resumo.vence_7)} tom={resumo.vence_7 ? "alerta" : "normal"} />
        <Indicador rotulo="Clientes devendo" valor={resumo.clientes} />
      </div>
      <Abas
        atual={filtro}
        itens={[
          { chave: "todas", rotulo: "Todas em aberto", href: "/contas" },
          { chave: "vencidas", rotulo: "Vencidas", href: "/contas?f=vencidas" },
          { chave: "a_vencer", rotulo: "A vencer", href: "/contas?f=a_vencer" },
        ]}
      />
      <Cartao>
        {lista.length === 0 ? (
          <Vazio>Nenhuma conta neste filtro. 🎉</Vazio>
        ) : (
          <TabelaRolavel>
            <table className="tabela">
              <thead>
                <tr><th>Cliente</th><th>Venda</th><th>Vencimento</th><th className="text-right">Valor</th><th className="text-right">Em aberto</th><th /></tr>
              </thead>
              <tbody>
                {lista.map((c) => {
                  const d = diasEntre(hj, c.vencimento);
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/clientes/${c.cliente_id}`} className="font-medium hover:underline">{c.cliente}</Link>
                        <div className="text-xs text-stone-400">{c.telefone}</div>
                      </td>
                      <td>{c.venda_id ? <Link href={`/vendas/${c.venda_id}`} className="link">#{c.venda_id}</Link> : "—"}</td>
                      <td>{dataBR(c.vencimento)}</td>
                      <td className="text-right tabular-nums">{reais(c.valor)}</td>
                      <td className="text-right font-medium tabular-nums">{reais(c.valor - c.pago)}</td>
                      <td className="text-right">
                        {d < 0 ? <Selo tom="vermelho">vencida há {dias(-d)}</Selo> : d === 0 ? <Selo tom="amarelo">vence hoje</Selo> : <Selo tom="azul">em {dias(d)}</Selo>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TabelaRolavel>
        )}
      </Cartao>
    </>
  );
}
