import { exigirSuperAdmin } from "@/lib/auth";
import { asc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { Cabecalho, Cartao, Indicador, Selo, TabelaRolavel, Vazio } from "@/components/ui";
import { faturas, tenants } from "@/db/schema";
import { getDb } from "@/lib/db";
import { bytes, dataBR, reais } from "@/lib/formato";
import { atividadeTenants } from "@/lib/servicos/admin-consultas";
import { calcularFatura, lerConfig, usoArmazenamento } from "@/lib/servicos/plataforma";

export const metadata = { title: "Visão geral" };

export default async function AdminInicio() {
  await exigirSuperAdmin();
  const db = await getDb();
  const [lista, uso, atividade, cfg, [abertas]] = await Promise.all([
    db.select().from(tenants).orderBy(asc(tenants.nome)),
    usoArmazenamento(db),
    atividadeTenants(db),
    lerConfig(db),
    db.select({ qtd: sql<number>`count(*)`, total: sql<number>`coalesce(sum(${faturas.totalCentavos}), 0)` }).from(faturas).where(eq(faturas.status, "ABERTA")),
  ]);

  const linhas = lista.map((t) => {
    const b = uso.get(t.id)?.bytes ?? 0;
    return { t, bytes: b, linhas: uso.get(t.id)?.linhas ?? 0, fatura: calcularFatura(b, cfg, t), at: atividade.get(t.id) };
  });
  const ativos = linhas.filter((l) => l.t.ativo);
  const totalBytes = linhas.reduce((s, l) => s + l.bytes, 0);
  const receitaPrevista = ativos.reduce((s, l) => s + l.fatura.total, 0);
  const conectados = linhas.reduce((s, l) => s + (l.at?.sessoes_ativas ?? 0), 0);

  return (
    <>
      <Cabecalho titulo="Visão geral" descricao="Mercearias atendidas, uso do banco e cobrança." acoes={<Link href="/admin/clientes/novo" className="btn-primario">+ Nova mercearia</Link>} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Indicador rotulo="Mercearias ativas" valor={ativos.length} detalhe={`${lista.length - ativos.length} suspensa(s)`} />
        <Indicador rotulo="Sessões conectadas" valor={conectados} detalhe="Logins ativos (não expirados)" />
        <Indicador rotulo="Armazenamento total" valor={bytes(totalBytes)} />
        <Indicador rotulo="Receita mensal prevista" valor={reais(receitaPrevista)} tom="ok" detalhe={abertas.qtd ? `${abertas.qtd} fatura(s) em aberto · ${reais(abertas.total)}` : "Nenhuma fatura em aberto"} />
      </div>
      <Cartao titulo="Mercearias">
        {linhas.length === 0 ? (
          <Vazio>Nenhuma mercearia cadastrada.</Vazio>
        ) : (
          <TabelaRolavel>
            <table className="tabela">
              <thead>
                <tr>
                  <th>Mercearia</th>
                  <th className="text-right">Usuários</th>
                  <th className="text-right">Conectados</th>
                  <th>Última venda</th>
                  <th className="text-right">Vendas 30d</th>
                  <th className="text-right">Armazenamento</th>
                  <th className="text-right">Fatura estimada</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {linhas.map(({ t, bytes: b, linhas: n, fatura, at }) => (
                  <tr key={t.id} className={t.ativo ? "" : "opacity-60"}>
                    <td>
                      <Link href={`/admin/clientes/${t.id}`} className="font-medium hover:underline">{t.nome}</Link>
                      <div className="text-xs text-stone-400">{t.slug}</div>
                    </td>
                    <td className="text-right tabular-nums">{at?.usuarios ?? 0}</td>
                    <td className="text-right tabular-nums">{at?.sessoes_ativas ? <Selo tom="verde">{at.sessoes_ativas}</Selo> : 0}</td>
                    <td>{dataBR(at?.ultima_venda)}</td>
                    <td className="text-right tabular-nums">{at?.vendas_30d ?? 0}</td>
                    <td className="text-right tabular-nums">
                      {bytes(b)}
                      <div className="text-xs text-stone-400">{n.toLocaleString("pt-BR")} registros</div>
                    </td>
                    <td className="text-right tabular-nums font-medium">{reais(fatura.total)}</td>
                    <td className="text-right">{!t.ativo && <Selo tom="vermelho">suspensa</Selo>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRolavel>
        )}
      </Cartao>
      <p className="mt-3 text-xs text-stone-500">
        O armazenamento é estimado somando o tamanho dos dados de cada mercearia no D1 (inclui imagens de fundo/logo salvas no banco).
        Preço atual: {reais(cfg.valorBaseCentavos)} base + {reais(cfg.valorPorMbCentavos)} por MB.
      </p>
    </>
  );
}
