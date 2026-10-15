import { exigirSuperAdmin } from "@/lib/auth";
import { criarTenant } from "@/app/admin/actions";
import { Enviar, Formulario } from "@/components/formulario";
import { Cabecalho, Cartao, Campo } from "@/components/ui";

export const metadata = { title: "Nova mercearia" };

export default async function NovaMercearia() {
  await exigirSuperAdmin();
  return (
    <>
      <Cabecalho titulo="Nova mercearia" descricao="Cria o ambiente do cliente com um usuário administrador. A aparência pode ser personalizada em seguida." />
      <Cartao className="max-w-2xl">
        <Formulario acao={criarTenant} className="space-y-5">
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-semibold">Mercearia</legend>
            <Campo rotulo="Nome *" className="sm:col-span-2"><input name="nome" className="campo" required /></Campo>
            <Campo rotulo="Identificador (URL de login)"><input name="slug" placeholder="gerado a partir do nome" className="campo" /></Campo>
            <Campo rotulo="CNPJ / CPF"><input name="documento" className="campo" /></Campo>
            <Campo rotulo="Telefone"><input name="telefone" className="campo" /></Campo>
            <Campo rotulo="E-mail de cobrança"><input name="email" type="email" className="campo" /></Campo>
          </fieldset>
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-semibold">Administrador da mercearia</legend>
            <Campo rotulo="Nome *"><input name="adminNome" className="campo" required /></Campo>
            <Campo rotulo="E-mail (login) *"><input name="adminEmail" type="email" className="campo" required /></Campo>
            <Campo rotulo="Senha inicial *"><input name="adminSenha" type="password" minLength={6} className="campo" required autoComplete="new-password" /></Campo>
          </fieldset>
          <Enviar>Criar mercearia</Enviar>
        </Formulario>
      </Cartao>
    </>
  );
}
