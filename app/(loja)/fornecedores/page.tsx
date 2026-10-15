import { asc, eq, sql } from "drizzle-orm";
import { Enviar, Formulario } from "@/components/formulario";
import { Cabecalho, Cartao, Campo, TabelaRolavel, Vazio } from "@/components/ui";
import { entradas, fornecedores } from "@/db/schema";
import { exigirTenant } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { dataBR, reais } from "@/lib/formato";
import { salvarFornecedor } from "./actions";

export const metadata = { title: "Fornecedores" };

export default async function Fornecedores() {
  const u = await exigirTenant();
  const db = await getDb();
  const lista = await db
    .select({
      id: fornecedores.id,
      nome: fornecedores.nome,
      documento: fornecedores.documento,
      telefone: fornecedores.telefone,
      compras: sql<number>`coalesce(sum(${entradas.totalCentavos}), 0)`,
      ultima: sql<string | null>`max(${entradas.data})`,
    })
    .from(fornecedores)
    .leftJoin(entradas, eq(entradas.fornecedorId, fornecedores.id))
    .where(eq(fornecedores.tenantId, u.tenantId))
    .groupBy(fornecedores.id)
    .orderBy(asc(fornecedores.nome));

  return (
    <>
      <Cabecalho titulo="Fornecedores" descricao="Quem abastece a mercearia." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Cartao titulo="Novo fornecedor">
          <Formulario acao={salvarFornecedor} limparAoSalvar className="space-y-3">
            <Campo rotulo="Nome *">
              <input name="nome" className="campo" required />
            </Campo>
            <Campo rotulo="CNPJ / CPF">
              <input name="documento" className="campo" />
            </Campo>
            <Campo rotulo="Telefone">
              <input name="telefone" className="campo" />
            </Campo>
            <Enviar>Adicionar</Enviar>
          </Formulario>
        </Cartao>
        <Cartao titulo={`${lista.length} fornecedores`} className="lg:col-span-2">
          {lista.length === 0 ? (
            <Vazio>Nenhum fornecedor cadastrado.</Vazio>
          ) : (
            <TabelaRolavel>
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Documento</th>
                    <th>Telefone</th>
                    <th className="text-right">Total comprado</th>
                    <th>Última entrada</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((f) => (
                    <tr key={f.id}>
                      <td className="font-medium">{f.nome}</td>
                      <td>{f.documento ?? "—"}</td>
                      <td>{f.telefone ?? "—"}</td>
                      <td className="text-right tabular-nums">{reais(f.compras)}</td>
                      <td>{dataBR(f.ultima)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabelaRolavel>
          )}
        </Cartao>
      </div>
    </>
  );
}
