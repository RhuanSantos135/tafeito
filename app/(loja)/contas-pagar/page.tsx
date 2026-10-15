import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import Link from "next/link";
import { Enviar, Formulario } from "@/components/formulario";
import { Abas, Cabecalho, Cartao, Campo, Indicador, Selo, TabelaRolavel, Vazio } from "@/components/ui";
import { categoriasDespesa, contasPagar, fornecedores } from "@/db/schema";
import { exigirTenant } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { dataBR, dias, diasEntre, hoje, reais, ROTULO_FORMA_PAGAR, somarDias } from "@/lib/formato";
import { despesasPorCategoria, FORMAS_PAGAR, garantirCategoriasDespesa, resumoContasPagar } from "@/lib/servicos/contas-pagar";
import { cancelarContaAcao, excluirCategoriaDespesa, pagarContaAcao, salvarCategoriaDespesa, salvarContaPagar } from "./actions";
import { CampoMoeda } from "@/components/campo-moeda";
import { Popover } from "@/components/popover";

export const metadata = { title: "Contas a pagar" };

const FILTROS = [
  { chave: "abertas", rotulo: "Em aberto" },
  { chave: "vencidas", rotulo: "Vencidas" },
  { chave: "proximas", rotulo: "Próximos 30 dias" },
  { chave: "pagas", rotulo: "Pagas" },
  { chave: "canceladas", rotulo: "Canceladas" },
] as const;

export default async function ContasPagar({ searchParams }: { searchParams: Promise<{ f?: string; cat?: string; quitada?: string; canceladas?: string }> }) {
  const u = await exigirTenant({ admin: true });
  const sp = await searchParams;
  const filtro = FILTROS.some((f) => f.chave === sp.f) ? sp.f! : "abertas";
  const cat = Number(sp.cat) || null;
  const db = await getDb();
  const hj = hoje();
  const mes = hj.slice(0, 7);

  const cats = await garantirCategoriasDespesa(db, u.tenantId);
  const condFiltro = {
    abertas: eq(contasPagar.status, "ABERTA"),
    vencidas: and(eq(contasPagar.status, "ABERTA"), lt(contasPagar.vencimento, hj)),
    proximas: and(eq(contasPagar.status, "ABERTA"), gte(contasPagar.vencimento, hj), sql`${contasPagar.vencimento} <= ${somarDias(hj, 30)}`),
    pagas: eq(contasPagar.status, "PAGA"),
    canceladas: eq(contasPagar.status, "CANCELADA"),
  }[filtro];

  const [lista, forns, resumo, porCategoria] = await Promise.all([
    db
      .select({
        c: contasPagar,
        categoria: categoriasDespesa.nome,
        fornecedor: fornecedores.nome,
        ultimoPagamento: sql<string | null>`(select max(data) from pagamentos_conta_pagar p where p.conta_pagar_id = ${contasPagar.id})`,
      })
      .from(contasPagar)
      .leftJoin(categoriasDespesa, eq(categoriasDespesa.id, contasPagar.categoriaId))
      .leftJoin(fornecedores, eq(fornecedores.id, contasPagar.fornecedorId))
      .where(and(eq(contasPagar.tenantId, u.tenantId), condFiltro, cat ? eq(contasPagar.categoriaId, cat) : undefined))
      .orderBy(filtro === "pagas" || filtro === "canceladas" ? desc(contasPagar.vencimento) : asc(contasPagar.vencimento))
      .limit(300),
    db.select({ id: fornecedores.id, nome: fornecedores.nome }).from(fornecedores).where(eq(fornecedores.tenantId, u.tenantId)).orderBy(asc(fornecedores.nome)),
    resumoContasPagar(db, u.tenantId),
    despesasPorCategoria(db, u.tenantId, mes),
  ]);
  const totalLista = lista.reduce((s, l) => s + (l.c.status === "ABERTA" ? l.c.valorCentavos - l.c.valorPagoCentavos : l.c.valorCentavos), 0);
  const maxCat = Math.max(...porCategoria.map((p) => p.total), 1);
  const url = (f: string, c: number | null) => `/contas-pagar?f=${f}${c ? `&cat=${c}` : ""}`;
  const [quitada] = sp.quitada
    ? await db.select({ descricao: contasPagar.descricao, valor: contasPagar.valorCentavos }).from(contasPagar).where(and(eq(contasPagar.id, Number(sp.quitada)), eq(contasPagar.tenantId, u.tenantId)))
    : [];

  return (
    <>
      <Cabecalho titulo="Contas a pagar" descricao="Fornecedores, luz, água, funcionários e demais despesas da mercearia." />
      {Number(sp.canceladas) > 0 && <p className="mb-4 rounded-lg bg-stone-200/70 px-3 py-2 text-sm text-stone-700">{Number(sp.canceladas) > 1 ? `${Number(sp.canceladas)} contas canceladas.` : "Conta cancelada."}</p>}
      {quitada && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">✓ “{quitada.descricao}” quitada ({reais(quitada.valor)}).</p>}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Indicador rotulo="Total a pagar" valor={reais(resumo.aberto)} detalhe={`${reais(resumo.vence_mes)} vencem neste mês`} />
        <Indicador rotulo="Vencido" valor={reais(resumo.vencido)} tom={resumo.vencido ? "perigo" : "ok"} detalhe={resumo.qtd_vencidas ? `${resumo.qtd_vencidas} conta(s) atrasada(s)` : "Nada atrasado"} />
        <Indicador rotulo="Vence em 7 dias" valor={reais(resumo.vence_7)} tom={resumo.vence_7 ? "alerta" : "normal"} />
        <Indicador rotulo="Pago neste mês" valor={reais(resumo.pagoMes)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <Abas atual={filtro} itens={FILTROS.map((f) => ({ ...f, href: url(f.chave, cat) }))} />
          <div className="mb-3 flex flex-wrap gap-1 text-xs">
            <Link href={url(filtro, null)} className={`rounded-full px-3 py-1 ${!cat ? "bg-primaria text-white" : "bg-white text-stone-600 ring-1 ring-stone-200"}`}>Todas as categorias</Link>
            {cats.map((c) => (
              <Link key={c.id} href={url(filtro, c.id)} className={`rounded-full px-3 py-1 ${cat === c.id ? "bg-primaria text-white" : "bg-white text-stone-600 ring-1 ring-stone-200"}`}>{c.nome}</Link>
            ))}
          </div>
          <Cartao titulo={`${lista.length} conta(s) · ${reais(totalLista)}`}>
            {lista.length === 0 ? (
              <Vazio>Nenhuma conta neste filtro.</Vazio>
            ) : (
              <TabelaRolavel>
                <table className="tabela">
                  <thead>
                    <tr><th>Vencimento</th><th>Descrição</th><th>Categoria</th><th className="text-right">Valor</th><th className="text-right">Em aberto</th><th /></tr>
                  </thead>
                  <tbody>
                    {lista.map(({ c, categoria, fornecedor, ultimoPagamento }) => {
                      const aberto = c.valorCentavos - c.valorPagoCentavos;
                      const d = diasEntre(hj, c.vencimento);
                      return (
                        <tr key={c.id} className="align-top">
                          <td className="whitespace-nowrap">
                            {dataBR(c.vencimento)}
                            <div className="mt-0.5">
                              {c.status === "PAGA" ? <Selo tom="verde">paga {dataBR(ultimoPagamento)}</Selo>
                                : c.status === "CANCELADA" ? <Selo>cancelada</Selo>
                                : d < 0 ? <Selo tom="vermelho">atrasada {dias(-d)}</Selo>
                                : d === 0 ? <Selo tom="vermelho">vence hoje</Selo>
                                : d <= 7 ? <Selo tom="amarelo">em {dias(d)}</Selo> : null}
                            </div>
                          </td>
                          <td>
                            <div className="font-medium">
                              {c.descricao}
                              {c.totalParcelas ? <span className="ml-1 text-xs font-normal text-stone-400">{c.parcela}/{c.totalParcelas}</span> : null}
                            </div>
                            <div className="text-xs text-stone-500">
                              {[fornecedor, c.documento && `Doc. ${c.documento}`].filter(Boolean).join(" · ")}
                              {c.entradaId && <> · <Link href={`/entradas/${c.entradaId}`} className="link">Entrada #{c.entradaId}</Link></>}
                            </div>
                            {c.observacao && <div className="text-xs text-stone-400">{c.observacao}</div>}
                          </td>
                          <td>{categoria ?? "—"}</td>
                          <td className="text-right tabular-nums">{reais(c.valorCentavos)}</td>
                          <td className="text-right font-medium tabular-nums">{c.status === "ABERTA" ? reais(aberto) : "—"}</td>
                          <td className="w-1 text-right">
                            {c.status === "ABERTA" && (
                              <Popover rotulo="Pagar">
                                  <Formulario acao={pagarContaAcao} className="space-y-2">
                                    <input type="hidden" name="id" value={c.id} />
                                    <input type="hidden" name="volta" value={url(filtro, cat)} />
                                    <Campo rotulo="Valor (aceita parcial)"><CampoMoeda name="valor" defaultCentavos={aberto} required /></Campo>
                                    <div className="grid grid-cols-2 gap-2">
                                      <Campo rotulo="Forma">
                                        <select name="forma" className="campo">
                                          {FORMAS_PAGAR.map((f) => <option key={f} value={f}>{ROTULO_FORMA_PAGAR[f]}</option>)}
                                        </select>
                                      </Campo>
                                      <Campo rotulo="Data"><input name="data" type="date" defaultValue={hj} className="campo" /></Campo>
                                    </div>
                                    <Enviar className="btn-primario w-full">Confirmar pagamento</Enviar>
                                  </Formulario>
                                  {c.valorPagoCentavos === 0 && (
                                    <Formulario acao={cancelarContaAcao} confirmar="Cancelar esta conta?" className="mt-3 border-t border-stone-100 pt-2">
                                      <input type="hidden" name="id" value={c.id} />
                                      <input type="hidden" name="volta" value={url(filtro, cat)} />
                                      {c.grupo && (
                                        <label className="mb-1 flex items-center gap-1 text-xs text-stone-600">
                                          <input type="checkbox" name="seguintes" value="1" /> Cancelar também as próximas desta série
                                        </label>
                                      )}
                                      <button className="text-xs text-red-600 hover:underline">Cancelar conta</button>
                                    </Formulario>
                                  )}
                              </Popover>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TabelaRolavel>
            )}
          </Cartao>
        </div>

        <div className="space-y-6">
          <Cartao titulo="Lançar conta">
            <Formulario acao={salvarContaPagar} limparAoSalvar className="space-y-3">
              <Campo rotulo="Descrição *"><input name="descricao" placeholder="Ex.: Conta de luz, Salário Maria" className="campo" required /></Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo rotulo="Categoria">
                  <select name="categoriaId" className="campo">
                    <option value="">—</option>
                    {cats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </Campo>
                <Campo rotulo="Fornecedor">
                  <select name="fornecedorId" className="campo">
                    <option value="">—</option>
                    {forns.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </Campo>
                <Campo rotulo="Valor *"><CampoMoeda name="valor" required /></Campo>
                <Campo rotulo="Vencimento *"><input name="vencimento" type="date" defaultValue={hj} className="campo" required /></Campo>
                <Campo rotulo="Repetição">
                  <select name="modo" className="campo">
                    <option value="UNICA">Só esta vez</option>
                    <option value="MENSAL">Todo mês (mesmo valor)</option>
                    <option value="PARCELADA">Parcelar o valor</option>
                  </select>
                </Campo>
                <Campo rotulo="Meses / parcelas"><input name="vezes" type="number" min={1} max={60} defaultValue={12} className="campo" /></Campo>
              </div>
              <Campo rotulo="Nº do boleto / NF"><input name="documento" className="campo" /></Campo>
              <Campo rotulo="Observação"><input name="observacao" className="campo" /></Campo>
              <p className="text-xs text-stone-500">“Todo mês” é ideal para luz, água, aluguel e salários: lança as próximas contas de uma vez.</p>
              <Enviar>Lançar</Enviar>
            </Formulario>
          </Cartao>

          <Cartao titulo="Pago neste mês por categoria">
            {porCategoria.length === 0 ? (
              <Vazio>Nenhum pagamento neste mês.</Vazio>
            ) : (
              <ul className="space-y-2 text-sm">
                {porCategoria.map((p) => (
                  <li key={p.categoria}>
                    <div className="flex justify-between"><span>{p.categoria}</span><span className="font-medium tabular-nums">{reais(p.total)}</span></div>
                    <div className="mt-1 h-1.5 rounded-full bg-stone-100"><div className="h-full rounded-full bg-primaria/70" style={{ width: `${(p.total / maxCat) * 100}%` }} /></div>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>

          <Cartao titulo="Categorias de despesa">
            <ul className="mb-3 divide-y divide-stone-100">
              {cats.map((c) => (
                <li key={c.id} className="flex items-center gap-2 py-1.5">
                  <Formulario acao={salvarCategoriaDespesa} className="flex flex-1 gap-1">
                    <input type="hidden" name="id" value={c.id} />
                    <input name="nome" defaultValue={c.nome} className="campo py-1" />
                    <Enviar className="btn-secundario btn-sm">OK</Enviar>
                  </Formulario>
                  <Formulario acao={excluirCategoriaDespesa} confirmar={`Excluir "${c.nome}"?`}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className="text-stone-400 hover:text-red-600" aria-label="Excluir">✕</button>
                  </Formulario>
                </li>
              ))}
            </ul>
            <Formulario acao={salvarCategoriaDespesa} limparAoSalvar className="flex gap-2">
              <input name="nome" placeholder="Nova categoria" className="campo" required />
              <Enviar className="btn-secundario">Adicionar</Enviar>
            </Formulario>
          </Cartao>
        </div>
      </div>
    </>
  );
}
