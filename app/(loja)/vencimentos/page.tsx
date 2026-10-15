import { and, asc, eq, lte } from "drizzle-orm";
import Link from "next/link";
import { categoriasDespesa, contasPagar } from "@/db/schema";
import { Abas, Cabecalho, Cartao, Indicador, Selo, TabelaRolavel, Vazio } from "@/components/ui";
import { exigirTenant } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { dataBR, dias as rotuloDias, diasEntre, hoje, qtd, reais, somarDias } from "@/lib/formato";
import { contasAReceber, lotesVencendo } from "@/lib/servicos/relatorios";

export const metadata = { title: "Vencimentos" };

export default async function Vencimentos({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const u = await exigirTenant();
  const dias = [7, 15, 30].includes(Number((await searchParams).dias)) ? Number((await searchParams).dias) : 30;
  const db = await getDb();
  const hj = hoje();
  const [lotes, contas, aPagar] = await Promise.all([
    lotesVencendo(db, u.tenantId, dias),
    contasAReceber(db, u.tenantId, "todas"),
    u.papel === "ADMIN"
      ? db
          .select({ c: contasPagar, categoria: categoriasDespesa.nome })
          .from(contasPagar)
          .leftJoin(categoriasDespesa, eq(categoriasDespesa.id, contasPagar.categoriaId))
          .where(and(eq(contasPagar.tenantId, u.tenantId), eq(contasPagar.status, "ABERTA"), lte(contasPagar.vencimento, somarDias(hj, dias))))
          .orderBy(asc(contasPagar.vencimento))
      : Promise.resolve(null),
  ]);
  const vencidos = lotes.filter((l) => l.validade < hj);
  const aVencer = lotes.filter((l) => l.validade >= hj);
  const valorEmRisco = aVencer.reduce((s, l) => s + Math.round(l.quantidade * l.custo), 0);
  const valorPerdido = vencidos.reduce((s, l) => s + Math.round(l.quantidade * l.custo), 0);
  const contasPeriodo = contas.filter((c) => diasEntre(hj, c.vencimento) <= dias);

  return (
    <>
      <Cabecalho titulo="Vencimentos" descricao="Validade dos lotes (para promover antes de virar perda), fiado a receber e contas a pagar." />
      <Abas
        atual={String(dias)}
        itens={[7, 15, 30].map((d) => ({ chave: String(d), rotulo: `Próximos ${d} dias`, href: `/vencimentos?dias=${d}` }))}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Indicador rotulo={`Lotes vencendo em ${dias} dias`} valor={aVencer.length} detalhe={`${reais(valorEmRisco)} em estoque (custo)`} tom={aVencer.length ? "alerta" : "ok"} />
        <Indicador rotulo="Lotes já vencidos com saldo" valor={vencidos.length} detalhe={vencidos.length ? `${reais(valorPerdido)} — registre a saída como "Vencido"` : "Nenhum"} tom={vencidos.length ? "perigo" : "ok"} />
        <Indicador rotulo="Fiado vencido ou vencendo" valor={reais(contasPeriodo.reduce((s, c) => s + c.valor - c.pago, 0))} detalhe={`${contasPeriodo.length} conta(s)`} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Cartao titulo="Validade de produtos" acoes={vencidos.length ? <Link href="/saidas" className="btn-secundario btn-sm">Registrar perda</Link> : null}>
          {lotes.length === 0 ? (
            <Vazio>Nenhum lote vencendo no período.</Vazio>
          ) : (
            <TabelaRolavel>
              <table className="tabela">
                <thead>
                  <tr><th>Produto</th><th>Lote</th><th className="text-right">Saldo</th><th>Validade</th><th /></tr>
                </thead>
                <tbody>
                  {lotes.map((l) => {
                    const d = diasEntre(hj, l.validade);
                    return (
                      <tr key={l.id}>
                        <td><Link href={`/produtos/${l.produto_id}`} className="font-medium hover:underline">{l.nome}</Link></td>
                        <td>{l.codigo ?? `#${l.id}`}</td>
                        <td className="text-right tabular-nums">{qtd(l.quantidade, l.unidade)}</td>
                        <td>{dataBR(l.validade)}</td>
                        <td className="text-right">
                          {d < 0 ? <Selo tom="vermelho">vencido</Selo> : d === 0 ? <Selo tom="vermelho">vence hoje</Selo> : d <= 7 ? <Selo tom="amarelo">{rotuloDias(d)}</Selo> : <Selo tom="azul">{rotuloDias(d)}</Selo>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TabelaRolavel>
          )}
        </Cartao>
        <Cartao titulo="Contas a receber" acoes={<Link href="/contas" className="link text-sm">Ver todas</Link>}>
          {contasPeriodo.length === 0 ? (
            <Vazio>Nenhum fiado vencendo no período.</Vazio>
          ) : (
            <TabelaRolavel>
              <table className="tabela">
                <thead>
                  <tr><th>Cliente</th><th>Vencimento</th><th className="text-right">Em aberto</th><th /></tr>
                </thead>
                <tbody>
                  {contasPeriodo.map((c) => {
                    const d = diasEntre(hj, c.vencimento);
                    return (
                      <tr key={c.id}>
                        <td><Link href={`/clientes/${c.cliente_id}`} className="font-medium hover:underline">{c.cliente}</Link></td>
                        <td>{dataBR(c.vencimento)}</td>
                        <td className="text-right tabular-nums">{reais(c.valor - c.pago)}</td>
                        <td className="text-right">{d < 0 ? <Selo tom="vermelho">vencida</Selo> : <Selo tom="amarelo">{d === 0 ? "hoje" : rotuloDias(d)}</Selo>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TabelaRolavel>
          )}
        </Cartao>
        {aPagar && (
          <Cartao titulo="Contas a pagar" className="xl:col-span-2" acoes={<Link href="/contas-pagar" className="link text-sm">Ver todas</Link>}>
            {aPagar.length === 0 ? (
              <Vazio>Nenhuma conta a pagar vencendo no período.</Vazio>
            ) : (
              <TabelaRolavel>
                <table className="tabela">
                  <thead>
                    <tr><th>Descrição</th><th>Categoria</th><th>Vencimento</th><th className="text-right">Em aberto</th><th /></tr>
                  </thead>
                  <tbody>
                    {aPagar.map(({ c, categoria }) => {
                      const d = diasEntre(hj, c.vencimento);
                      return (
                        <tr key={c.id}>
                          <td className="font-medium">{c.descricao}{c.totalParcelas ? <span className="ml-1 text-xs font-normal text-stone-400">{c.parcela}/{c.totalParcelas}</span> : null}</td>
                          <td>{categoria ?? "—"}</td>
                          <td>{dataBR(c.vencimento)}</td>
                          <td className="text-right tabular-nums">{reais(c.valorCentavos - c.valorPagoCentavos)}</td>
                          <td className="text-right">{d < 0 ? <Selo tom="vermelho">atrasada</Selo> : <Selo tom="amarelo">{d === 0 ? "hoje" : rotuloDias(d)}</Selo>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TabelaRolavel>
            )}
          </Cartao>
        )}
      </div>
    </>
  );
}
