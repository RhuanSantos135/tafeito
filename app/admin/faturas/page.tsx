import { exigirSuperAdmin } from "@/lib/auth";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { alterarStatusFatura, gerarFaturasAcao } from "@/app/admin/actions";
import { Enviar, Formulario } from "@/components/formulario";
import { Cabecalho, Cartao, Indicador, Selo, TabelaRolavel, Vazio } from "@/components/ui";
import { faturas, tenants } from "@/db/schema";
import { getDb } from "@/lib/db";
import { bytes, dataBR, hoje, reais } from "@/lib/formato";

export const metadata = { title: "Faturas" };

export default async function Faturas({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  await exigirSuperAdmin();
  const { c } = await searchParams;
  const db = await getDb();
  const competencia = c && /^\d{4}-\d{2}$/.test(c) ? c : hoje().slice(0, 7);
  const lista = await db
    .select({ f: faturas, nome: tenants.nome })
    .from(faturas)
    .innerJoin(tenants, eq(tenants.id, faturas.tenantId))
    .where(eq(faturas.competencia, competencia))
    .orderBy(desc(faturas.totalCentavos));
  const competencias = await db.selectDistinct({ c: faturas.competencia }).from(faturas).orderBy(desc(faturas.competencia)).limit(12);
  const soma = (s: string) => lista.filter((l) => l.f.status === s).reduce((t, l) => t + l.f.totalCentavos, 0);
  const hj = hoje();

  return (
    <>
      <Cabecalho titulo="Faturas" descricao="Cobrança mensal: mensalidade base + armazenamento ocupado no banco." />
      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_2fr]">
        <Cartao titulo="Gerar faturas">
          <Formulario acao={gerarFaturasAcao} className="space-y-3">
            <label className="block">
              <span className="rotulo">Competência</span>
              <input type="month" name="competencia" defaultValue={competencia} className="campo" required />
            </label>
            <p className="text-xs text-stone-500">Mede o armazenamento atual de cada mercearia ativa. Rodar de novo recalcula as faturas ainda abertas.</p>
            <Enviar>Gerar / recalcular</Enviar>
          </Formulario>
        </Cartao>
        <div className="grid gap-4 sm:grid-cols-3">
          <Indicador rotulo={`Em aberto (${competencia})`} valor={reais(soma("ABERTA"))} tom="alerta" />
          <Indicador rotulo="Recebido" valor={reais(soma("PAGA"))} tom="ok" />
          <Indicador rotulo="Faturas" valor={lista.length} />
        </div>
      </div>
      {competencias.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1">
          {competencias.map(({ c: x }) => (
            <Link key={x} href={`/admin/faturas?c=${x}`} className={x === competencia ? "btn-primario btn-sm" : "btn-secundario btn-sm"}>{x}</Link>
          ))}
        </div>
      )}
      <Cartao>
        {lista.length === 0 ? (
          <Vazio>Nenhuma fatura para {competencia}. Use “Gerar faturas”.</Vazio>
        ) : (
          <TabelaRolavel>
            <table className="tabela">
              <thead>
                <tr><th>Mercearia</th><th className="text-right">Armazenamento</th><th className="text-right">Base</th><th className="text-right">Armaz.</th><th className="text-right">Total</th><th>Vencimento</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {lista.map(({ f, nome }) => (
                  <tr key={f.id}>
                    <td><Link href={`/admin/clientes/${f.tenantId}`} className="font-medium hover:underline">{nome}</Link></td>
                    <td className="text-right tabular-nums">{bytes(f.armazenamentoBytes)}</td>
                    <td className="text-right tabular-nums">{reais(f.valorBaseCentavos)}</td>
                    <td className="text-right tabular-nums">{reais(f.valorArmazenamentoCentavos)}</td>
                    <td className="text-right font-medium tabular-nums">{reais(f.totalCentavos)}</td>
                    <td>{dataBR(f.vencimento)}</td>
                    <td>
                      {f.status === "PAGA" ? <Selo tom="verde">paga {dataBR(f.pagaEm)}</Selo> : f.status === "CANCELADA" ? <Selo>cancelada</Selo> : f.vencimento < hj ? <Selo tom="vermelho">vencida</Selo> : <Selo tom="amarelo">aberta</Selo>}
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        {f.status !== "PAGA" && (
                          <Formulario acao={alterarStatusFatura}>
                            <input type="hidden" name="id" value={f.id} />
                            <input type="hidden" name="status" value="PAGA" />
                            <Enviar className="btn-secundario btn-sm">Marcar paga</Enviar>
                          </Formulario>
                        )}
                        {f.status === "ABERTA" && (
                          <Formulario acao={alterarStatusFatura} confirmar="Cancelar esta fatura?">
                            <input type="hidden" name="id" value={f.id} />
                            <input type="hidden" name="status" value="CANCELADA" />
                            <Enviar className="btn-secundario btn-sm">Cancelar</Enviar>
                          </Formulario>
                        )}
                        {f.status !== "ABERTA" && (
                          <Formulario acao={alterarStatusFatura}>
                            <input type="hidden" name="id" value={f.id} />
                            <input type="hidden" name="status" value="ABERTA" />
                            <Enviar className="btn-secundario btn-sm">Reabrir</Enviar>
                          </Formulario>
                        )}
                      </div>
                    </td>
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
