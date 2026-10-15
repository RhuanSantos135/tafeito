import { and, asc, desc, eq, gt } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecalho, Cartao, Indicador, Selo, TabelaRolavel, Vazio } from "@/components/ui";
import { categorias, lotes, movimentacoesEstoque, produtos } from "@/db/schema";
import { exigirTenant } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { dataBR, dias, diasEntre, hoje, qtd, reais, ROTULO_MOTIVO } from "@/lib/formato";
import { saldos } from "@/lib/servicos/estoque";
import { FormProduto } from "../form-produto";

export default async function EditarProduto({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigirTenant();
  const id = Number((await params).id);
  const db = await getDb();
  const [p] = await db
    .select()
    .from(produtos)
    .where(and(eq(produtos.id, id), eq(produtos.tenantId, u.tenantId)));
  if (!p) notFound();

  const [cats, lotesAtivos, movs, mapa] = await Promise.all([
    db.select().from(categorias).where(eq(categorias.tenantId, u.tenantId)).orderBy(asc(categorias.nome)),
    db.select().from(lotes).where(and(eq(lotes.produtoId, id), gt(lotes.quantidade, 0))).orderBy(asc(lotes.validade)),
    db.select().from(movimentacoesEstoque).where(eq(movimentacoesEstoque.produtoId, id)).orderBy(desc(movimentacoesEstoque.data)).limit(30),
    saldos(db, u.tenantId, [id]),
  ]);
  const saldo = mapa.get(id) ?? 0;
  const margem = p.precoVendaCentavos - p.precoCustoCentavos;
  const hj = hoje();

  return (
    <>
      <Cabecalho titulo={p.nome} descricao={p.codigoBarras ?? undefined} acoes={<Link href="/produtos" className="btn-secundario">Voltar</Link>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Indicador rotulo="Saldo em estoque" valor={qtd(saldo, p.unidade)} tom={saldo <= p.estoqueMinimo ? "perigo" : "normal"} detalhe={`Mínimo: ${qtd(p.estoqueMinimo, p.unidade)}`} />
        <Indicador rotulo="Margem unitária" valor={reais(margem)} detalhe={p.precoVendaCentavos ? `${((margem / p.precoVendaCentavos) * 100).toFixed(1)}% sobre a venda` : undefined} tom={margem > 0 ? "ok" : "perigo"} />
        <Indicador rotulo="Valor em estoque (custo)" valor={reais(Math.max(0, saldo) * p.precoCustoCentavos)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao titulo="Dados do produto">
          <FormProduto produto={p} categorias={cats} />
        </Cartao>
        <div className="space-y-6">
          <Cartao titulo="Lotes em estoque">
            {lotesAtivos.length === 0 ? (
              <Vazio>Nenhum lote com saldo.</Vazio>
            ) : (
              <TabelaRolavel>
                <table className="tabela">
                  <thead>
                    <tr><th>Lote</th><th className="text-right">Saldo</th><th>Validade</th><th className="text-right">Custo</th></tr>
                  </thead>
                  <tbody>
                    {lotesAtivos.map((l) => {
                      const d = l.validade ? diasEntre(hj, l.validade) : null;
                      return (
                        <tr key={l.id}>
                          <td>{l.codigo ?? `#${l.id}`}</td>
                          <td className="text-right tabular-nums">{qtd(l.quantidade, p.unidade)}</td>
                          <td>
                            {dataBR(l.validade)}{" "}
                            {d !== null && d < 0 && <Selo tom="vermelho">vencido</Selo>}
                            {d !== null && d >= 0 && d <= 15 && <Selo tom="amarelo">{dias(d)}</Selo>}
                          </td>
                          <td className="text-right tabular-nums">{reais(l.custoUnitarioCentavos)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TabelaRolavel>
            )}
          </Cartao>
          <Cartao titulo="Últimas movimentações">
            {movs.length === 0 ? (
              <Vazio>Sem movimentações.</Vazio>
            ) : (
              <TabelaRolavel>
                <table className="tabela">
                  <thead>
                    <tr><th>Data</th><th>Tipo</th><th className="text-right">Qtd</th><th>Motivo</th></tr>
                  </thead>
                  <tbody>
                    {movs.map((m) => (
                      <tr key={m.id}>
                        <td className="whitespace-nowrap">{dataBR(m.data)}</td>
                        <td><Selo tom={m.quantidade > 0 ? "verde" : "cinza"}>{m.tipo}</Selo></td>
                        <td className={`text-right tabular-nums ${m.quantidade < 0 ? "text-red-600" : "text-emerald-700"}`}>{m.quantidade > 0 ? "+" : ""}{qtd(m.quantidade)}</td>
                        <td className="text-stone-500">{m.motivo ? (ROTULO_MOTIVO[m.motivo] ?? m.motivo) : m.vendaId ? `Venda #${m.vendaId}` : "—"}</td>
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
