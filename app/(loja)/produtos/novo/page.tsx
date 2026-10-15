import { asc, eq } from "drizzle-orm";
import { Cabecalho, Cartao } from "@/components/ui";
import { categorias } from "@/db/schema";
import { exigirTenant } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { FormProduto } from "../form-produto";

export const metadata = { title: "Novo produto" };

export default async function NovoProduto() {
  const u = await exigirTenant();
  const db = await getDb();
  const cats = await db.select().from(categorias).where(eq(categorias.tenantId, u.tenantId)).orderBy(asc(categorias.nome));
  return (
    <>
      <Cabecalho titulo="Novo produto" />
      <Cartao className="max-w-3xl">
        <FormProduto categorias={cats} />
      </Cartao>
    </>
  );
}
