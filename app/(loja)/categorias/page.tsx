import { asc, count, eq } from "drizzle-orm";
import { Enviar, Formulario } from "@/components/formulario";
import { Cabecalho, Cartao, TabelaRolavel, Vazio } from "@/components/ui";
import { categorias, produtos } from "@/db/schema";
import { exigirTenant } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { excluirCategoria, salvarCategoria } from "./actions";

export const metadata = { title: "Categorias" };

export default async function Categorias() {
  const u = await exigirTenant();
  const db = await getDb();
  const lista = await db
    .select({ id: categorias.id, nome: categorias.nome, produtos: count(produtos.id) })
    .from(categorias)
    .leftJoin(produtos, eq(produtos.categoriaId, categorias.id))
    .where(eq(categorias.tenantId, u.tenantId))
    .groupBy(categorias.id)
    .orderBy(asc(categorias.nome));

  return (
    <>
      <Cabecalho titulo="Categorias" descricao="Organize os produtos por seção da mercearia." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Cartao titulo="Nova categoria">
          <Formulario acao={salvarCategoria} limparAoSalvar className="space-y-3">
            <input name="nome" placeholder="Ex.: Bebidas" className="campo" required />
            <Enviar>Adicionar</Enviar>
          </Formulario>
        </Cartao>
        <Cartao titulo={`${lista.length} categorias`} className="lg:col-span-2">
          {lista.length === 0 ? (
            <Vazio>Nenhuma categoria cadastrada.</Vazio>
          ) : (
            <TabelaRolavel>
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th className="text-right">Produtos</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lista.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Formulario acao={salvarCategoria} className="flex gap-2">
                          <input type="hidden" name="id" value={c.id} />
                          <input name="nome" defaultValue={c.nome} className="campo py-1" />
                          <Enviar className="btn-secundario btn-sm">Salvar</Enviar>
                        </Formulario>
                      </td>
                      <td className="text-right tabular-nums">{c.produtos}</td>
                      <td className="text-right">
                        <Formulario acao={excluirCategoria} confirmar={`Excluir a categoria "${c.nome}"?`}>
                          <input type="hidden" name="id" value={c.id} />
                          <button className="btn-secundario btn-sm text-red-600">Excluir</button>
                        </Formulario>
                      </td>
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
