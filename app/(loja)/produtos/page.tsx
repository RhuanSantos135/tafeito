import { and, asc, eq, like, or } from "drizzle-orm";
import Link from "next/link";
import { Cabecalho, Cartao, Selo, TabelaRolavel, Vazio } from "@/components/ui";
import { categorias, produtos } from "@/db/schema";
import { exigirTenant } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { qtd, reais } from "@/lib/formato";
import { saldos } from "@/lib/servicos/estoque";

export const metadata = { title: "Produtos" };

export default async function Produtos({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string; criado?: string }> }) {
  const u = await exigirTenant();
  const { q, cat, criado } = await searchParams;
  const db = await getDb();
  const busca = q?.trim();
  const [lista, cats, mapa] = await Promise.all([
    db
      .select({ p: produtos, categoria: categorias.nome })
      .from(produtos)
      .leftJoin(categorias, eq(categorias.id, produtos.categoriaId))
      .where(
        and(
          eq(produtos.tenantId, u.tenantId),
          busca ? or(like(produtos.nome, `%${busca}%`), eq(produtos.codigoBarras, busca)) : undefined,
          cat ? eq(produtos.categoriaId, Number(cat)) : undefined,
        ),
      )
      .orderBy(asc(produtos.nome)),
    db.select().from(categorias).where(eq(categorias.tenantId, u.tenantId)).orderBy(asc(categorias.nome)),
    saldos(db, u.tenantId),
  ]);

  return (
    <>
      <Cabecalho
        titulo="Produtos"
        descricao="Cadastro com preço, custo, margem e estoque mínimo."
        acoes={<Link href="/produtos/novo" className="btn-primario">+ Novo produto</Link>}
      />
      {criado && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Produto cadastrado. Lance a primeira entrada em <Link href="/entradas/nova" className="link">Entradas</Link>.</p>}
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar por nome ou código de barras" className="campo max-w-sm" />
        <select name="cat" defaultValue={cat ?? ""} className="campo w-auto">
          <option value="">Todas as categorias</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
        <button className="btn-secundario">Filtrar</button>
      </form>
      <Cartao>
        {lista.length === 0 ? (
          <Vazio>Nenhum produto encontrado.</Vazio>
        ) : (
          <TabelaRolavel>
            <table className="tabela">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Categoria</th>
                  <th className="text-right">Custo</th>
                  <th className="text-right">Venda</th>
                  <th className="text-right">Margem</th>
                  <th className="text-right">Estoque</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lista.map(({ p, categoria }) => {
                  const saldo = mapa.get(p.id) ?? 0;
                  const margem = p.precoVendaCentavos ? ((p.precoVendaCentavos - p.precoCustoCentavos) / p.precoVendaCentavos) * 100 : 0;
                  return (
                    <tr key={p.id} className={p.ativo ? "" : "opacity-50"}>
                      <td>
                        <Link href={`/produtos/${p.id}`} className="font-medium hover:underline">{p.nome}</Link>
                        <div className="text-xs text-stone-400">{p.codigoBarras}</div>
                      </td>
                      <td>{categoria ?? "—"}</td>
                      <td className="text-right tabular-nums">{reais(p.precoCustoCentavos)}</td>
                      <td className="text-right tabular-nums font-medium">{reais(p.precoVendaCentavos)}</td>
                      <td className={`text-right tabular-nums ${margem < 15 ? "text-amber-600" : ""}`}>{margem.toFixed(1)}%</td>
                      <td className="text-right tabular-nums">{qtd(saldo, p.unidade)}</td>
                      <td className="text-right">
                        {!p.ativo ? <Selo>inativo</Selo> : saldo <= 0 ? <Selo tom="vermelho">sem estoque</Selo> : saldo <= p.estoqueMinimo ? <Selo tom="amarelo">abaixo do mínimo</Selo> : null}
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
