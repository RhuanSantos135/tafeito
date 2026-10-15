import { and, asc, eq } from "drizzle-orm";
import { Cabecalho, Cartao } from "@/components/ui";
import { fornecedores, produtos } from "@/db/schema";
import { exigirTenant } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { hoje, somarDias } from "@/lib/formato";
import { FormEntrada } from "./form-entrada";

export const metadata = { title: "Nova entrada" };

export default async function NovaEntrada() {
  const u = await exigirTenant();
  const db = await getDb();
  const [prods, forns] = await Promise.all([
    db
      .select({ id: produtos.id, nome: produtos.nome, codigoBarras: produtos.codigoBarras, unidade: produtos.unidade, precoCustoCentavos: produtos.precoCustoCentavos })
      .from(produtos)
      .where(and(eq(produtos.tenantId, u.tenantId), eq(produtos.ativo, true)))
      .orderBy(asc(produtos.nome)),
    db.select({ id: fornecedores.id, nome: fornecedores.nome }).from(fornecedores).where(eq(fornecedores.tenantId, u.tenantId)).orderBy(asc(fornecedores.nome)),
  ]);
  return (
    <>
      <Cabecalho titulo="Nova entrada" descricao="Registre a mercadoria recebida. Cada item vira um lote com sua validade e soma no estoque." />
      <Cartao>
        <FormEntrada produtos={prods} fornecedores={forns} hoje={hoje()} vencimentoPadrao={somarDias(hoje(), 30)} podeLancarConta={u.papel === "ADMIN"} />
      </Cartao>
    </>
  );
}
