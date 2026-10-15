import { Enviar, Formulario } from "@/components/formulario";
import { Campo } from "@/components/ui";
import type { clientes } from "@/db/schema";
import { salvarCliente } from "./actions";
import { CampoMoeda } from "@/components/campo-moeda";

export function FormCliente({ cliente }: { cliente?: typeof clientes.$inferSelect }) {
  return (
    <Formulario acao={salvarCliente} className="space-y-3">
      {cliente && <input type="hidden" name="id" value={cliente.id} />}
      <Campo rotulo="Nome *">
        <input name="nome" defaultValue={cliente?.nome} className="campo" required />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Telefone">
          <input name="telefone" defaultValue={cliente?.telefone ?? ""} className="campo" />
        </Campo>
        <Campo rotulo="CPF">
          <input name="cpf" defaultValue={cliente?.cpf ?? ""} className="campo" />
        </Campo>
        <Campo rotulo="Limite de crédito">
          <CampoMoeda name="limite" defaultCentavos={cliente?.limiteCreditoCentavos} />
        </Campo>
        <Campo rotulo="Prazo padrão (dias)">
          <input name="diasPrazo" type="number" min={1} max={365} defaultValue={cliente?.diasPrazo ?? 30} className="campo" />
        </Campo>
      </div>
      {cliente && (
        <Campo rotulo="Situação">
          <select name="ativo" defaultValue={cliente.ativo ? "1" : "0"} className="campo">
            <option value="1">Ativo</option>
            <option value="0">Inativo</option>
          </select>
        </Campo>
      )}
      <Enviar>{cliente ? "Salvar" : "Cadastrar cliente"}</Enviar>
    </Formulario>
  );
}
