import { asc, eq } from "drizzle-orm";
import { FormTema } from "@/components/form-tema";
import { Enviar, Formulario } from "@/components/formulario";
import { GestaoUsuarios } from "@/components/gestao-usuarios";
import { Cabecalho, Cartao, Campo } from "@/components/ui";
import { tenants, usuarios } from "@/db/schema";
import { exigirTenant } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { salvarDadosLoja } from "./actions";

export const metadata = { title: "Configurações" };

export default async function Configuracoes() {
  const u = await exigirTenant({ admin: true });
  const db = await getDb();
  const [[t], us] = await Promise.all([
    db.select().from(tenants).where(eq(tenants.id, u.tenantId)),
    db
      .select({ id: usuarios.id, nome: usuarios.nome, email: usuarios.email, papel: usuarios.papel, ativo: usuarios.ativo })
      .from(usuarios)
      .where(eq(usuarios.tenantId, u.tenantId))
      .orderBy(asc(usuarios.nome)),
  ]);

  return (
    <>
      <Cabecalho titulo="Configurações" descricao="Dados da mercearia, aparência e usuários." />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Cartao titulo="Dados da mercearia">
            <Formulario acao={salvarDadosLoja} className="space-y-3">
              <Campo rotulo="Nome *"><input name="nome" defaultValue={t.nome} className="campo" required /></Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo rotulo="CNPJ / CPF"><input name="documento" defaultValue={t.documento ?? ""} className="campo" /></Campo>
                <Campo rotulo="Telefone"><input name="telefone" defaultValue={t.telefone ?? ""} className="campo" /></Campo>
              </div>
              <Campo rotulo="E-mail"><input name="email" type="email" defaultValue={t.email ?? ""} className="campo" /></Campo>
              <p className="text-xs text-stone-500">Link de login personalizado: <code className="rounded bg-stone-100 px-1">/login?loja={t.slug}</code></p>
              <Enviar>Salvar</Enviar>
            </Formulario>
          </Cartao>
          <Cartao titulo="Usuários">
            <GestaoUsuarios tenantId={t.id} usuarios={us} />
          </Cartao>
        </div>
        <Cartao titulo="Aparência">
          <FormTema tenant={t} />
        </Cartao>
      </div>
    </>
  );
}
