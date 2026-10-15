import { exigirSuperAdmin } from "@/lib/auth";
import { salvarConfigAcao, trocarSenhaAdmin } from "@/app/admin/actions";
import { Enviar, Formulario } from "@/components/formulario";
import { Cabecalho, Cartao, Campo } from "@/components/ui";
import { getDb } from "@/lib/db";
import { lerConfig } from "@/lib/servicos/plataforma";
import { CampoMoeda } from "@/components/campo-moeda";

export const metadata = { title: "Preços e conta" };

export default async function ConfigAdmin() {
  await exigirSuperAdmin();
  const db = await getDb();
  const cfg = await lerConfig(db);
  return (
    <>
      <Cabecalho titulo="Preços e conta" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao titulo="Tabela de preços padrão">
          <Formulario acao={salvarConfigAcao} className="space-y-3">
            <Campo rotulo="Mensalidade base"><CampoMoeda name="valorBase" defaultCentavos={cfg.valorBaseCentavos} /></Campo>
            <Campo rotulo="Preço por MB armazenado"><CampoMoeda name="valorPorMb" defaultCentavos={cfg.valorPorMbCentavos} /></Campo>
            <Campo rotulo="Dia de vencimento (mês seguinte)"><input name="diaVencimento" type="number" min={1} max={28} defaultValue={cfg.diaVencimento} className="campo" /></Campo>
            <p className="text-xs text-stone-500">Cada mercearia pode ter preço próprio na sua ficha. O MB é arredondado para cima.</p>
            <Enviar>Salvar preços</Enviar>
          </Formulario>
        </Cartao>
        <Cartao titulo="Alterar minha senha">
          <Formulario acao={trocarSenhaAdmin} limparAoSalvar className="space-y-3">
            <Campo rotulo="Senha atual"><input name="atual" type="password" className="campo" required autoComplete="current-password" /></Campo>
            <Campo rotulo="Nova senha (mín. 8)"><input name="nova" type="password" minLength={8} className="campo" required autoComplete="new-password" /></Campo>
            <Enviar>Alterar senha</Enviar>
          </Formulario>
        </Cartao>
      </div>
    </>
  );
}
