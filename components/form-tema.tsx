import { salvarTema } from "@/app/acoes-compartilhadas";
import { Enviar, Formulario } from "@/components/formulario";
import { resolverTema } from "@/lib/tema";

type T = { id: number; corPrimaria: string | null; corSecundaria: string | null; fundoUrl: string | null; logoUrl: string | null };

function CampoImagem({ nome, rotulo, atual }: { nome: "fundo" | "logo"; rotulo: string; atual: string | null }) {
  return (
    <fieldset className="space-y-2 rounded-lg border border-stone-200 p-3">
      <legend className="px-1 text-xs font-medium text-stone-600">{rotulo}</legend>
      {atual && (
        <div className="flex items-center gap-3">
          <img src={atual} alt="" className={nome === "logo" ? "h-10 w-auto" : "h-16 w-28 rounded object-cover"} />
          <label className="flex items-center gap-1 text-xs text-stone-600">
            <input type="checkbox" name={`${nome}Remover`} value="1" /> Remover
          </label>
        </div>
      )}
      <input type="file" name={`${nome}Arquivo`} accept="image/*" className="block w-full text-xs file:mr-2 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-1.5" />
      <input name={`${nome}Url`} placeholder="…ou cole uma URL https://" className="campo py-1 text-xs" />
    </fieldset>
  );
}

/** Personalização visual da mercearia (fundo, logo e cores). Vazio = padrão Tá Feito. */
export function FormTema({ tenant }: { tenant: T }) {
  const tema = resolverTema(tenant);
  return (
    <div className="space-y-3">
      <Formulario acao={salvarTema} className="space-y-4">
        <input type="hidden" name="tenantId" value={tenant.id} />
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="rotulo">Cor principal</span>
            <input type="color" name="corPrimaria" defaultValue={tema.corPrimaria} className="h-10 w-full cursor-pointer rounded-lg border border-stone-300" />
          </label>
          <label className="block">
            <span className="rotulo">Cor de destaque</span>
            <input type="color" name="corSecundaria" defaultValue={tema.corSecundaria} className="h-10 w-full cursor-pointer rounded-lg border border-stone-300" />
          </label>
        </div>
        <CampoImagem nome="fundo" rotulo="Imagem de fundo (login e sistema)" atual={tenant.fundoUrl} />
        <CampoImagem nome="logo" rotulo="Logotipo" atual={tenant.logoUrl} />
        <Enviar>Salvar aparência</Enviar>
      </Formulario>
      <Formulario acao={salvarTema} confirmar="Voltar para o visual padrão Tá Feito?">
        <input type="hidden" name="tenantId" value={tenant.id} />
        <input type="hidden" name="restaurar" value="1" />
        <button className="text-xs text-stone-500 hover:underline">Restaurar padrão Tá Feito</button>
      </Formulario>
    </div>
  );
}
