import { and, asc, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Abas, Cabecalho, Cartao, Indicador, Selo, TabelaRolavel, Vazio } from "@/components/ui";
import { categorias, movimentacoesEstoque, produtos, TIPOS_MOVIMENTACAO, usuarios } from "@/db/schema";
import { exigirTenant } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { dataBR, qtd, reais, ROTULO_MOTIVO } from "@/lib/formato";
import { saldos } from "@/lib/servicos/estoque";

export const metadata = { title: "Estoque" };

const TOM_TIPO = { ENTRADA: "verde", VENDA: "azul", SAIDA: "amarelo", AJUSTE: "cinza", ESTORNO: "vermelho" } as const;

export default async function Estoque({ searchParams }: { searchParams: Promise<{ aba?: string; tipo?: string }> }) {
  const u = await exigirTenant();
  const { aba = "saldo", tipo } = await searchParams;
  const db = await getDb();

  const abas = (
    <Abas
      atual={aba}
      itens={[
        { chave: "saldo", rotulo: "Saldo por produto", href: "/estoque" },
        { chave: "mov", rotulo: "Movimentações", href: "/estoque?aba=mov" },
      ]}
    />
  );

  if (aba === "mov") {
    const tipoValido = (TIPOS_MOVIMENTACAO as readonly string[]).includes(tipo ?? "") ? (tipo as (typeof TIPOS_MOVIMENTACAO)[number]) : undefined;
    const movs = await db
      .select({ m: movimentacoesEstoque, produto: produtos.nome, unidade: produtos.unidade, usuario: usuarios.nome })
      .from(movimentacoesEstoque)
      .innerJoin(produtos, eq(produtos.id, movimentacoesEstoque.produtoId))
      .leftJoin(usuarios, eq(usuarios.id, movimentacoesEstoque.usuarioId))
      .where(and(eq(movimentacoesEstoque.tenantId, u.tenantId), tipoValido ? eq(movimentacoesEstoque.tipo, tipoValido) : undefined))
      .orderBy(desc(movimentacoesEstoque.data), desc(movimentacoesEstoque.id))
      .limit(300);
    return (
      <>
        <Cabecalho titulo="Estoque" descricao="Todas as movimentações: o saldo é sempre a soma delas." />
        {abas}
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          <Link href="/estoque?aba=mov" className={!tipoValido ? "btn-primario btn-sm" : "btn-secundario btn-sm"}>Todas</Link>
          {TIPOS_MOVIMENTACAO.map((t) => (
            <Link key={t} href={`/estoque?aba=mov&tipo=${t}`} className={tipoValido === t ? "btn-primario btn-sm" : "btn-secundario btn-sm"}>{t}</Link>
          ))}
        </div>
        <Cartao>
          {movs.length === 0 ? (
            <Vazio>Nenhuma movimentação.</Vazio>
          ) : (
            <TabelaRolavel>
              <table className="tabela">
                <thead>
                  <tr><th>Data</th><th>Produto</th><th>Tipo</th><th className="text-right">Quantidade</th><th>Origem / motivo</th><th>Usuário</th></tr>
                </thead>
                <tbody>
                  {movs.map(({ m, produto, unidade, usuario }) => (
                    <tr key={m.id}>
                      <td className="whitespace-nowrap">{dataBR(m.data)}</td>
                      <td><Link href={`/produtos/${m.produtoId}`} className="hover:underline">{produto}</Link></td>
                      <td><Selo tom={TOM_TIPO[m.tipo]}>{m.tipo}</Selo></td>
                      <td className={`text-right tabular-nums ${m.quantidade < 0 ? "text-red-600" : "text-emerald-700"}`}>{m.quantidade > 0 ? "+" : ""}{qtd(m.quantidade, unidade)}</td>
                      <td className="text-stone-500">
                        {m.vendaId ? <Link href={`/vendas/${m.vendaId}`} className="link">Venda #{m.vendaId}</Link> : m.entradaId ? <Link href={`/entradas/${m.entradaId}`} className="link">Entrada #{m.entradaId}</Link> : (ROTULO_MOTIVO[m.motivo ?? ""] ?? m.motivo ?? "—")}
                        {m.observacao ? ` · ${m.observacao}` : ""}
                      </td>
                      <td>{usuario ?? "—"}</td>
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

  const [prods, mapa] = await Promise.all([
    db
      .select({ p: produtos, categoria: categorias.nome })
      .from(produtos)
      .leftJoin(categorias, eq(categorias.id, produtos.categoriaId))
      .where(and(eq(produtos.tenantId, u.tenantId), eq(produtos.ativo, true)))
      .orderBy(asc(produtos.nome)),
    saldos(db, u.tenantId),
  ]);
  const linhas = prods.map(({ p, categoria }) => {
    const saldo = mapa.get(p.id) ?? 0;
    return { p, categoria, saldo, custo: Math.round(Math.max(0, saldo) * p.precoCustoCentavos), venda: Math.round(Math.max(0, saldo) * p.precoVendaCentavos) };
  });
  const totalCusto = linhas.reduce((s, l) => s + l.custo, 0);
  const totalVenda = linhas.reduce((s, l) => s + l.venda, 0);
  const negativos = linhas.filter((l) => l.saldo < 0).length;

  return (
    <>
      <Cabecalho titulo="Estoque" descricao="Saldo atual calculado a partir das movimentações." />
      {abas}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Indicador rotulo="Estoque a preço de custo" valor={reais(totalCusto)} />
        <Indicador rotulo="Estoque a preço de venda" valor={reais(totalVenda)} detalhe={`Lucro potencial ${reais(totalVenda - totalCusto)}`} />
        <Indicador rotulo="Produtos com saldo negativo" valor={negativos} tom={negativos ? "perigo" : "ok"} detalhe={negativos ? "Vendidos sem entrada lançada — faça uma entrada ou ajuste" : "Tudo certo"} />
      </div>
      <Cartao>
        <TabelaRolavel>
          <table className="tabela">
            <thead>
              <tr><th>Produto</th><th>Categoria</th><th className="text-right">Saldo</th><th className="text-right">Mínimo</th><th className="text-right">Valor (custo)</th><th /></tr>
            </thead>
            <tbody>
              {linhas.map(({ p, categoria, saldo, custo }) => (
                <tr key={p.id}>
                  <td><Link href={`/produtos/${p.id}`} className="font-medium hover:underline">{p.nome}</Link></td>
                  <td>{categoria ?? "—"}</td>
                  <td className={`text-right tabular-nums ${saldo < 0 ? "text-red-600" : ""}`}>{qtd(saldo, p.unidade)}</td>
                  <td className="text-right tabular-nums text-stone-500">{qtd(p.estoqueMinimo)}</td>
                  <td className="text-right tabular-nums">{reais(custo)}</td>
                  <td className="text-right">{saldo <= 0 ? <Selo tom="vermelho">zerado</Selo> : saldo <= p.estoqueMinimo ? <Selo tom="amarelo">repor</Selo> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabelaRolavel>
      </Cartao>
    </>
  );
}
