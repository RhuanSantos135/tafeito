import { and, asc, desc, eq, gt, inArray } from "drizzle-orm";
import { Enviar, Formulario } from "@/components/formulario";
import { Cabecalho, Cartao, Campo, Selo, TabelaRolavel, Vazio } from "@/components/ui";
import { lotes, MOTIVOS_SAIDA, movimentacoesEstoque, produtos, usuarios } from "@/db/schema";
import { exigirTenant } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { dataBR, qtd, ROTULO_MOTIVO } from "@/lib/formato";
import { saldos } from "@/lib/servicos/estoque";
import { salvarAjuste, salvarSaida } from "./actions";
import { SeletorProdutoLote } from "./seletor-produto-lote";

export const metadata = { title: "Saídas e ajustes" };

export default async function Saidas() {
  const u = await exigirTenant();
  const db = await getDb();
  const [prods, lts, mapa, historico] = await Promise.all([
    db.select().from(produtos).where(and(eq(produtos.tenantId, u.tenantId), eq(produtos.ativo, true))).orderBy(asc(produtos.nome)),
    db.select().from(lotes).where(and(eq(lotes.tenantId, u.tenantId), gt(lotes.quantidade, 0))).orderBy(asc(lotes.validade)),
    saldos(db, u.tenantId),
    db
      .select({ m: movimentacoesEstoque, produto: produtos.nome, unidade: produtos.unidade, usuario: usuarios.nome })
      .from(movimentacoesEstoque)
      .innerJoin(produtos, eq(produtos.id, movimentacoesEstoque.produtoId))
      .leftJoin(usuarios, eq(usuarios.id, movimentacoesEstoque.usuarioId))
      .where(and(eq(movimentacoesEstoque.tenantId, u.tenantId), inArray(movimentacoesEstoque.tipo, ["SAIDA", "AJUSTE"])))
      .orderBy(desc(movimentacoesEstoque.data))
      .limit(100),
  ]);
  const opcoes = prods.map((p) => ({ id: p.id, nome: p.nome, unidade: p.unidade, saldo: mapa.get(p.id) ?? 0 }));
  const opcoesLote = lts.map((l) => ({ id: l.id, produtoId: l.produtoId, rotulo: `${l.codigo ?? `#${l.id}`} · val. ${dataBR(l.validade)} · saldo ${qtd(l.quantidade)}` }));

  return (
    <>
      <Cabecalho titulo="Saídas e ajustes" descricao="Tudo que sai do estoque sem ser venda — sempre com motivo, para o estoque fechar." />
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Cartao titulo="Registrar saída">
          <Formulario acao={salvarSaida} limparAoSalvar className="space-y-3">
            <SeletorProdutoLote produtos={opcoes} lotes={opcoesLote} />
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Quantidade *">
                <input name="quantidade" className="campo" inputMode="decimal" required />
              </Campo>
              <Campo rotulo="Motivo *">
                <select name="motivo" className="campo" required>
                  <option value="">Selecione…</option>
                  {MOTIVOS_SAIDA.filter((m) => m !== "AJUSTE_INVENTARIO").map((m) => (
                    <option key={m} value={m}>{ROTULO_MOTIVO[m]}</option>
                  ))}
                </select>
              </Campo>
            </div>
            <Campo rotulo="Observação">
              <input name="observacao" className="campo" />
            </Campo>
            <Enviar>Registrar saída</Enviar>
          </Formulario>
        </Cartao>
        <Cartao titulo="Ajuste de inventário">
          <p className="mb-3 text-sm text-stone-500">Conte o produto na prateleira e informe a quantidade real. O sistema lança a diferença automaticamente.</p>
          <Formulario acao={salvarAjuste} limparAoSalvar className="space-y-3">
            <SeletorProdutoLote produtos={opcoes} lotes={[]} comLote={false} />
            <Campo rotulo="Quantidade contada *">
              <input name="contagem" className="campo" inputMode="decimal" required />
            </Campo>
            <Campo rotulo="Observação">
              <input name="observacao" className="campo" />
            </Campo>
            <Enviar>Lançar ajuste</Enviar>
          </Formulario>
        </Cartao>
      </div>
      <Cartao titulo="Histórico de saídas e ajustes">
        {historico.length === 0 ? (
          <Vazio>Nenhuma saída registrada.</Vazio>
        ) : (
          <TabelaRolavel>
            <table className="tabela">
              <thead>
                <tr><th>Data</th><th>Produto</th><th>Motivo</th><th className="text-right">Quantidade</th><th>Observação</th><th>Usuário</th></tr>
              </thead>
              <tbody>
                {historico.map(({ m, produto, unidade, usuario }) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap">{dataBR(m.data)}</td>
                    <td className="font-medium">{produto}</td>
                    <td><Selo tom={m.tipo === "AJUSTE" ? "azul" : "amarelo"}>{ROTULO_MOTIVO[m.motivo ?? ""] ?? m.motivo}</Selo></td>
                    <td className={`text-right tabular-nums ${m.quantidade < 0 ? "text-red-600" : "text-emerald-700"}`}>{m.quantidade > 0 ? "+" : ""}{qtd(m.quantidade, unidade)}</td>
                    <td className="text-stone-500">{m.observacao ?? "—"}</td>
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
