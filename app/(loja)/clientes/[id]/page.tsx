import { and, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Enviar, Formulario } from "@/components/formulario";
import { Cabecalho, Cartao, Campo, Indicador, Selo, TabelaRolavel, Vazio } from "@/components/ui";
import { clientes, contasReceber, pagamentos, vendas } from "@/db/schema";
import { exigirTenant } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { dataBR, hoje, reais, ROTULO_PAGAMENTO } from "@/lib/formato";
import { situacaoCredito, statusConta } from "@/lib/servicos/vendas";
import { registrarPagamento } from "../actions";
import { FormCliente } from "../form-cliente";
import { CampoMoeda } from "@/components/campo-moeda";

const TOM = { ABERTA: "azul", VENCIDA: "vermelho", PAGA: "verde", CANCELADA: "cinza" } as const;

export default async function VerCliente({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigirTenant();
  const id = Number((await params).id);
  const db = await getDb();
  const [c] = await db
    .select()
    .from(clientes)
    .where(and(eq(clientes.id, id), eq(clientes.tenantId, u.tenantId)));
  if (!c) notFound();

  const [sit, contas, pags, compras] = await Promise.all([
    situacaoCredito(db, u.tenantId, id),
    db.select().from(contasReceber).where(eq(contasReceber.clienteId, id)).orderBy(desc(contasReceber.vencimento)),
    db
      .select({ p: pagamentos })
      .from(pagamentos)
      .innerJoin(contasReceber, eq(contasReceber.id, pagamentos.contaReceberId))
      .where(eq(contasReceber.clienteId, id))
      .orderBy(desc(pagamentos.data))
      .limit(50),
    db.select().from(vendas).where(eq(vendas.clienteId, id)).orderBy(desc(vendas.data)).limit(30),
  ]);
  const hj = hoje();
  const abertas = contas.filter((x) => x.status === "ABERTA");

  return (
    <>
      <Cabecalho titulo={c.nome} descricao={[c.telefone, c.cpf].filter(Boolean).join(" · ") || undefined} acoes={<Link href="/clientes" className="btn-secundario">Voltar</Link>} />
      {sit.bloqueado && sit.devedorCentavos > 0 && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">⛔ Fiado bloqueado: {sit.motivoBloqueio}</p>}
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Indicador rotulo="Saldo devedor" valor={reais(sit.devedorCentavos)} tom={sit.devedorCentavos ? "alerta" : "normal"} />
        <Indicador rotulo="Vencido" valor={reais(sit.vencidoCentavos)} tom={sit.vencidoCentavos ? "perigo" : "normal"} detalhe={sit.contasVencidas ? `${sit.contasVencidas} conta(s)` : undefined} />
        <Indicador rotulo="Limite" valor={reais(sit.limiteCentavos)} />
        <Indicador rotulo="Crédito disponível" valor={reais(sit.disponivelCentavos)} tom="ok" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          {(sit.devedorCentavos > 0 || pags.length > 0) && (
            <Cartao titulo="Receber pagamento">
              {/* Mantido montado mesmo quitado, para a mensagem de confirmação não sumir */}
              <Formulario acao={registrarPagamento} limparAoSalvar className="space-y-3">
                <input type="hidden" name="clienteId" value={c.id} />
                {sit.devedorCentavos === 0 && <p className="text-sm text-stone-500">Nenhum valor em aberto. 🎉</p>}
                <fieldset disabled={sit.devedorCentavos === 0} className="space-y-3 disabled:opacity-50">
                <Campo rotulo="Valor — aceita pagamento parcial">
                  <CampoMoeda name="valor" defaultCentavos={sit.devedorCentavos || null} className="text-lg" required />
                </Campo>
                <Campo rotulo="Abater de">
                  <select name="contaId" className="campo">
                    <option value="">Contas mais antigas primeiro</option>
                    {abertas.map((x) => (
                      <option key={x.id} value={x.id}>Conta #{x.id} · venc. {dataBR(x.vencimento)} · {reais(x.valorCentavos - x.valorPagoCentavos)}</option>
                    ))}
                  </select>
                </Campo>
                <Campo rotulo="Forma">
                  <select name="forma" className="campo">
                    <option value="DINHEIRO">Dinheiro</option>
                    <option value="PIX">Pix</option>
                    <option value="DEBITO">Cartão débito</option>
                    <option value="CREDITO">Cartão crédito</option>
                  </select>
                </Campo>
                <Enviar>Registrar pagamento</Enviar>
                </fieldset>
              </Formulario>
            </Cartao>
          )}
          <Cartao titulo="Dados do cliente">
            <FormCliente cliente={c} />
          </Cartao>
        </div>
        <div className="space-y-6 lg:col-span-2">
          <Cartao titulo="Contas (fiado)">
            {contas.length === 0 ? (
              <Vazio>Nenhuma compra a prazo.</Vazio>
            ) : (
              <TabelaRolavel>
                <table className="tabela">
                  <thead>
                    <tr><th>Conta</th><th>Venda</th><th>Vencimento</th><th className="text-right">Valor</th><th className="text-right">Pago</th><th className="text-right">Em aberto</th><th /></tr>
                  </thead>
                  <tbody>
                    {contas.map((x) => {
                      const st = statusConta(x, hj);
                      return (
                        <tr key={x.id}>
                          <td>#{x.id}</td>
                          <td>{x.vendaId ? <Link href={`/vendas/${x.vendaId}`} className="link">#{x.vendaId}</Link> : "—"}</td>
                          <td>{dataBR(x.vencimento)}</td>
                          <td className="text-right tabular-nums">{reais(x.valorCentavos)}</td>
                          <td className="text-right tabular-nums">{reais(x.valorPagoCentavos)}</td>
                          <td className="text-right tabular-nums font-medium">{x.status === "ABERTA" ? reais(x.valorCentavos - x.valorPagoCentavos) : "—"}</td>
                          <td className="text-right"><Selo tom={TOM[st]}>{st}</Selo></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TabelaRolavel>
            )}
          </Cartao>
          <div className="grid gap-6 xl:grid-cols-2">
            <Cartao titulo="Pagamentos recebidos">
              {pags.length === 0 ? (
                <Vazio>Nenhum pagamento.</Vazio>
              ) : (
                <ul className="divide-y divide-stone-100 text-sm">
                  {pags.map(({ p }) => (
                    <li key={p.id} className="flex justify-between py-2">
                      <span>{dataBR(p.data)} · {ROTULO_PAGAMENTO[p.forma]} <span className="text-stone-400">(conta #{p.contaReceberId})</span></span>
                      <span className="font-medium tabular-nums text-emerald-700">{reais(p.valorCentavos)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>
            <Cartao titulo="Últimas compras">
              {compras.length === 0 ? (
                <Vazio>Nenhuma compra.</Vazio>
              ) : (
                <ul className="divide-y divide-stone-100 text-sm">
                  {compras.map((v) => (
                    <li key={v.id} className={`flex justify-between py-2 ${v.status === "CANCELADA" ? "line-through opacity-50" : ""}`}>
                      <Link href={`/vendas/${v.id}`} className="hover:underline">{dataBR(v.data)} · {ROTULO_PAGAMENTO[v.formaPagamento]}</Link>
                      <span className="tabular-nums">{reais(v.totalCentavos)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>
          </div>
        </div>
      </div>
    </>
  );
}
