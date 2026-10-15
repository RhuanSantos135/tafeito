import Link from "next/link";
import { GraficoBarras } from "@/components/grafico-barras";
import { Cartao, Indicador, Selo, TabelaRolavel, Vazio } from "@/components/ui";
import { exigirTenant } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { dataBR, dias, diasEntre, hoje, qtd, reais } from "@/lib/formato";
import {
  desempenhoProdutos,
  lotesVencendo,
  produtosAbaixoMinimo,
  produtosParados,
  resumoFaturamento,
  resumoFiado,
  vendasPorDia,
} from "@/lib/servicos/relatorios";
import { resumoContasPagar } from "@/lib/servicos/contas-pagar";

export const metadata = { title: "Dashboard" };

function Ranking<T extends { id: number; nome: string }>({ itens, valor, formatar }: { itens: T[]; valor: (i: T) => number; formatar: (n: number, i: T) => string }) {
  const max = Math.max(...itens.map(valor), 1);
  return (
    <ol className="space-y-2">
      {itens.map((i, n) => (
        <li key={i.id} className="text-sm">
          <div className="flex justify-between gap-2">
            <span className="truncate"><span className="mr-2 text-stone-400 tabular-nums">{n + 1}.</span>{i.nome}</span>
            <span className="whitespace-nowrap font-medium tabular-nums">{formatar(valor(i), i)}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-stone-100">
            <div className="h-full rounded-full bg-primaria/70" style={{ width: `${(valor(i) / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ parados?: string }> }) {
  const u = await exigirTenant();
  const diasParado = [15, 30, 60, 90].includes(Number((await searchParams).parados)) ? Number((await searchParams).parados) : 30;
  const db = await getDb();
  const [fat, serie, desempenho, minimo, parados, lotes, fiado] = await Promise.all([
    resumoFaturamento(db, u.tenantId),
    vendasPorDia(db, u.tenantId, 30),
    desempenhoProdutos(db, u.tenantId, 30),
    produtosAbaixoMinimo(db, u.tenantId),
    produtosParados(db, u.tenantId, diasParado),
    lotesVencendo(db, u.tenantId, 15),
    resumoFiado(db, u.tenantId),
  ]);
  const pagar = u.papel === "ADMIN" ? await resumoContasPagar(db, u.tenantId) : null;
  const hj = hoje();
  const porQtd = [...desempenho].sort((a, b) => b.quantidade - a.quantidade).slice(0, 8);
  const porFat = [...desempenho].sort((a, b) => b.faturamento - a.faturamento).slice(0, 8);
  const porMargem = [...desempenho].sort((a, b) => b.margem - a.margem);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Olá, {u.nome.split(" ")[0]} 👋</h1>
          <p className="text-sm text-stone-500">Resumo da mercearia em {dataBR(hj)}.</p>
        </div>
        <Link href="/pdv" className="btn-primario">🛒 Abrir PDV</Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Indicador rotulo="Hoje" valor={reais(fat.dia.total)} detalhe={`${fat.dia.vendas} vendas · ticket ${reais(fat.dia.ticket)}`} />
        <Indicador rotulo="Últimos 7 dias" valor={reais(fat.semana.total)} detalhe={`${fat.semana.vendas} vendas · ticket ${reais(fat.semana.ticket)}`} />
        <Indicador rotulo="Este mês" valor={reais(fat.mes.total)} detalhe={`${fat.mes.vendas} vendas · ticket ${reais(fat.mes.ticket)}`} />
        <Indicador rotulo="Lucro bruto no mês" valor={reais(fat.mes.lucroBruto)} tom="ok" detalhe={fat.mes.total ? `${((fat.mes.lucroBruto / fat.mes.total) * 100).toFixed(1)}% de margem` : undefined} />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Cartao titulo="Faturamento por dia — últimos 30 dias" className="lg:col-span-2">
          <GraficoBarras dados={serie} />
        </Cartao>
        <div className="space-y-4">
        <Cartao titulo="Fiado" acoes={<Link href="/contas" className="link text-sm">Ver contas</Link>}>
          <div className="space-y-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-stone-500">Total a receber</div>
              <div className="text-2xl font-bold tabular-nums">{reais(fiado.aberto)}</div>
              <div className="text-xs text-stone-500">{fiado.clientes} cliente(s)</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-stone-500">Vencido</div>
              <div className={`text-2xl font-bold tabular-nums ${fiado.vencido ? "text-red-600" : ""}`}>{reais(fiado.vencido)}</div>
              {fiado.aberto > 0 && (
                <div className="mt-1 h-2 rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-red-500" style={{ width: `${(fiado.vencido / fiado.aberto) * 100}%` }} />
                </div>
              )}
            </div>
            <div className="text-sm text-stone-500">Vence nos próximos 7 dias: <b className="text-stone-800">{reais(fiado.vence_7)}</b></div>
          </div>
        </Cartao>
        {pagar && (
          <Cartao titulo="Contas a pagar" acoes={<Link href="/contas-pagar" className="link text-sm">Ver contas</Link>}>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wide text-stone-500">Vencido</div>
                <div className={`text-xl font-bold tabular-nums ${pagar.vencido ? "text-red-600" : ""}`}>{reais(pagar.vencido)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-stone-500">Próx. 7 dias</div>
                <div className="text-xl font-bold tabular-nums">{reais(pagar.vence_7)}</div>
              </div>
            </div>
            <div className="mt-3 text-sm text-stone-500">Pago neste mês: <b className="text-stone-800">{reais(pagar.pagoMes)}</b></div>
          </Cartao>
        )}
        </div>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Cartao titulo="Mais vendidos por quantidade (30 dias)">
          {porQtd.length ? <Ranking itens={porQtd} valor={(i) => i.quantidade} formatar={(n, i) => qtd(Math.round(n * 1000) / 1000, i.unidade)} /> : <Vazio>Sem vendas no período.</Vazio>}
        </Cartao>
        <Cartao titulo="Mais vendidos por faturamento (30 dias)">
          {porFat.length ? <Ranking itens={porFat} valor={(i) => i.faturamento} formatar={(n) => reais(n)} /> : <Vazio>Sem vendas no período.</Vazio>}
        </Cartao>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Cartao titulo={`Abaixo do estoque mínimo (${minimo.length})`} acoes={<Link href="/entradas/nova" className="btn-secundario btn-sm">Lançar entrada</Link>}>
          {minimo.length === 0 ? (
            <Vazio>Nenhum produto abaixo do mínimo. 👍</Vazio>
          ) : (
            <ul className="divide-y divide-stone-100 text-sm">
              {minimo.slice(0, 10).map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2">
                  <Link href={`/produtos/${p.id}`} className="hover:underline">{p.nome}</Link>
                  <span className="tabular-nums">
                    <b className={p.saldo <= 0 ? "text-red-600" : "text-amber-600"}>{qtd(Math.round(p.saldo * 1000) / 1000, p.unidade)}</b>
                    <span className="text-stone-400"> / mín. {qtd(p.estoque_minimo)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
        <Cartao titulo="Lotes perto do vencimento (15 dias)" acoes={<Link href="/vencimentos" className="link text-sm">Ver todos</Link>}>
          {lotes.length === 0 ? (
            <Vazio>Nenhum lote vencendo.</Vazio>
          ) : (
            <ul className="divide-y divide-stone-100 text-sm">
              {lotes.slice(0, 10).map((l) => {
                const d = diasEntre(hj, l.validade);
                return (
                  <li key={l.id} className="flex items-center justify-between gap-2 py-2">
                    <span>{l.nome} <span className="text-stone-400">· {qtd(l.quantidade, l.unidade)}</span></span>
                    {d < 0 ? <Selo tom="vermelho">vencido</Selo> : <Selo tom={d <= 7 ? "amarelo" : "azul"}>{d === 0 ? "hoje" : dias(d)}</Selo>}
                  </li>
                );
              })}
            </ul>
          )}
        </Cartao>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Cartao titulo="Margem por produto (30 dias)">
          {porMargem.length === 0 ? (
            <Vazio>Sem vendas no período.</Vazio>
          ) : (
            <TabelaRolavel>
              <div className="max-h-96 overflow-y-auto">
                <table className="tabela">
                  <thead className="sticky top-0">
                    <tr><th>Produto</th><th className="text-right">Venda</th><th className="text-right">Custo</th><th className="text-right">Margem</th><th className="text-right">%</th></tr>
                  </thead>
                  <tbody>
                    {porMargem.map((p) => (
                      <tr key={p.id}>
                        <td>{p.nome}</td>
                        <td className="text-right tabular-nums">{reais(p.faturamento)}</td>
                        <td className="text-right tabular-nums text-stone-500">{reais(p.custo)}</td>
                        <td className={`text-right font-medium tabular-nums ${p.margem < 0 ? "text-red-600" : ""}`}>{reais(p.margem)}</td>
                        <td className={`text-right tabular-nums ${p.margemPct < 15 ? "text-amber-600" : ""}`}>{p.margemPct.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabelaRolavel>
          )}
        </Cartao>
        <Cartao
          titulo={`Produtos parados (sem venda há ${diasParado}+ dias)`}
          acoes={
            <div className="flex gap-1 text-xs">
              {[15, 30, 60, 90].map((d) => (
                <Link key={d} href={`/?parados=${d}`} className={`rounded px-2 py-0.5 ${d === diasParado ? "bg-primaria text-white" : "bg-stone-100 text-stone-600"}`}>{d}d</Link>
              ))}
            </div>
          }
        >
          {parados.length === 0 ? (
            <Vazio>Todos os produtos com estoque estão girando.</Vazio>
          ) : (
            <ul className="max-h-96 divide-y divide-stone-100 overflow-y-auto text-sm">
              {parados.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    <Link href={`/produtos/${p.id}`} className="hover:underline">{p.nome}</Link>
                    <span className="block text-xs text-stone-400">{p.ultima_venda ? `Última venda ${dataBR(p.ultima_venda)}` : "Nunca vendido"} · {qtd(Math.round(p.saldo * 1000) / 1000, p.unidade)}</span>
                  </span>
                  <span className="whitespace-nowrap text-xs text-stone-500">{reais(p.valor_parado)} parado</span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>
    </>
  );
}
