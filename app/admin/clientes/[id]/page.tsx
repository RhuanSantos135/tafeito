import { exigirSuperAdmin } from "@/lib/auth";
import { asc, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { atualizarTenant } from "@/app/admin/actions";
import { FormTema } from "@/components/form-tema";
import { Enviar, Formulario } from "@/components/formulario";
import { GestaoUsuarios } from "@/components/gestao-usuarios";
import { Cabecalho, Cartao, Campo, Indicador, Selo, TabelaRolavel } from "@/components/ui";
import { faturas, tenants, usuarios } from "@/db/schema";
import { getDb } from "@/lib/db";
import { bytes, dataBR, reais } from "@/lib/formato";
import { atividadeTenants } from "@/lib/servicos/admin-consultas";
import { calcularFatura, lerConfig, usoArmazenamento } from "@/lib/servicos/plataforma";
import { CampoMoeda } from "@/components/campo-moeda";

const ROTULO_TABELA: Record<string, string> = {
  tenants: "Cadastro e imagens", usuarios: "Usuários", categorias: "Categorias", produtos: "Produtos", fornecedores: "Fornecedores",
  clientes: "Clientes", entradas: "Entradas", lotes: "Lotes", movimentacoes_estoque: "Movimentações", vendas: "Vendas",
  venda_itens: "Itens de venda", contas_receber: "Contas a receber", pagamentos: "Pagamentos",
  categorias_despesa: "Categorias de despesa", contas_pagar: "Contas a pagar", pagamentos_conta_pagar: "Pagamentos de contas",
};

export default async function AdminTenant({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ criado?: string }> }) {
  await exigirSuperAdmin();
  const id = Number((await params).id);
  const { criado } = await searchParams;
  const db = await getDb();
  const [t] = await db.select().from(tenants).where(eq(tenants.id, id));
  if (!t) notFound();
  const [uso, at, cfg, us, fs] = await Promise.all([
    usoArmazenamento(db),
    atividadeTenants(db),
    lerConfig(db),
    db.select({ id: usuarios.id, nome: usuarios.nome, email: usuarios.email, papel: usuarios.papel, ativo: usuarios.ativo }).from(usuarios).where(eq(usuarios.tenantId, id)).orderBy(asc(usuarios.nome)),
    db.select().from(faturas).where(eq(faturas.tenantId, id)).orderBy(desc(faturas.competencia)).limit(12),
  ]);
  const u = uso.get(id);
  const a = at.get(id);
  const fatura = calcularFatura(u?.bytes ?? 0, cfg, t);

  return (
    <>
      <Cabecalho
        titulo={t.nome}
        descricao={`Cliente desde ${dataBR(t.criadoEm)} · login: /login?loja=${t.slug}`}
        acoes={<Link href="/admin" className="btn-secundario">Voltar</Link>}
      />
      {criado && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Mercearia criada! Personalize a aparência abaixo e envie o login ao cliente.</p>}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Indicador rotulo="Armazenamento" valor={bytes(u?.bytes ?? 0)} detalhe={`${(u?.linhas ?? 0).toLocaleString("pt-BR")} registros`} />
        <Indicador rotulo="Conectados agora" valor={a?.sessoes_ativas ?? 0} detalhe={`Último login ${dataBR(a?.ultimo_login)}`} />
        <Indicador rotulo="Vendas (30 dias)" valor={a?.vendas_30d ?? 0} detalhe={`Última ${dataBR(a?.ultima_venda)}`} />
        <Indicador rotulo="Fatura estimada" valor={reais(fatura.total)} detalhe={`${reais(fatura.base)} base + ${fatura.mb} MB × ${reais(t.valorPorMbCentavos ?? cfg.valorPorMbCentavos)}`} tom="ok" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Cartao titulo="Dados e cobrança">
            <Formulario acao={atualizarTenant} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="id" value={t.id} />
              <Campo rotulo="Nome *" className="sm:col-span-2"><input name="nome" defaultValue={t.nome} className="campo" required /></Campo>
              <Campo rotulo="Identificador"><input name="slug" defaultValue={t.slug} className="campo" /></Campo>
              <Campo rotulo="CNPJ / CPF"><input name="documento" defaultValue={t.documento ?? ""} className="campo" /></Campo>
              <Campo rotulo="E-mail"><input name="email" defaultValue={t.email ?? ""} className="campo" /></Campo>
              <Campo rotulo="Telefone"><input name="telefone" defaultValue={t.telefone ?? ""} className="campo" /></Campo>
              <Campo rotulo={`Mensalidade base (padrão ${reais(cfg.valorBaseCentavos)})`}>
                <CampoMoeda name="valorBase" defaultCentavos={t.valorBaseCentavos} placeholder="usar padrão" />
              </Campo>
              <Campo rotulo={`Preço por MB (padrão ${reais(cfg.valorPorMbCentavos)})`}>
                <CampoMoeda name="valorPorMb" defaultCentavos={t.valorPorMbCentavos} placeholder="usar padrão" />
              </Campo>
              <Campo rotulo="Situação">
                <select name="ativo" defaultValue={t.ativo ? "1" : "0"} className="campo">
                  <option value="1">Ativa</option>
                  <option value="0">Suspensa (bloqueia acesso)</option>
                </select>
              </Campo>
              <div className="sm:col-span-2"><Enviar>Salvar</Enviar></div>
            </Formulario>
          </Cartao>
          <Cartao titulo="Usuários da mercearia">
            <GestaoUsuarios tenantId={t.id} usuarios={us} />
          </Cartao>
        </div>
        <div className="space-y-6">
          <Cartao titulo="Aparência">
            <FormTema tenant={t} />
          </Cartao>
          <Cartao titulo="Uso por tabela">
            <TabelaRolavel>
              <table className="tabela">
                <thead><tr><th>Dados</th><th className="text-right">Registros</th><th className="text-right">Tamanho</th></tr></thead>
                <tbody>
                  {Object.entries(u?.porTabela ?? {})
                    .sort((x, y) => y[1].bytes - x[1].bytes)
                    .map(([tab, v]) => (
                      <tr key={tab}>
                        <td>{ROTULO_TABELA[tab] ?? tab}</td>
                        <td className="text-right tabular-nums">{v.linhas.toLocaleString("pt-BR")}</td>
                        <td className="text-right tabular-nums">{bytes(v.bytes)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </TabelaRolavel>
          </Cartao>
          <Cartao titulo="Faturas" acoes={<Link href="/admin/faturas" className="link text-sm">Gerenciar</Link>}>
            {fs.length === 0 ? (
              <p className="text-sm text-stone-400">Nenhuma fatura gerada.</p>
            ) : (
              <ul className="divide-y divide-stone-100 text-sm">
                {fs.map((f) => (
                  <li key={f.id} className="flex items-center justify-between py-2">
                    <span>{f.competencia} · {bytes(f.armazenamentoBytes)}</span>
                    <span className="flex items-center gap-2">
                      <b className="tabular-nums">{reais(f.totalCentavos)}</b>
                      <Selo tom={f.status === "PAGA" ? "verde" : f.status === "CANCELADA" ? "cinza" : "amarelo"}>{f.status}</Selo>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        </div>
      </div>
    </>
  );
}
