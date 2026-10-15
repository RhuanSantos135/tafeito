import { Enviar, Formulario } from "@/components/formulario";
import { Campo } from "@/components/ui";
import type { produtos } from "@/db/schema";
import { salvarProduto } from "./actions";
import { CampoMoeda } from "@/components/campo-moeda";

type Produto = typeof produtos.$inferSelect;

export function FormProduto({ produto, categorias }: { produto?: Produto; categorias: { id: number; nome: string }[] }) {
  return (
    <Formulario acao={salvarProduto} className="grid gap-4 sm:grid-cols-2">
      {produto && <input type="hidden" name="id" value={produto.id} />}
      <Campo rotulo="Nome *" className="sm:col-span-2">
        <input name="nome" defaultValue={produto?.nome} className="campo" required autoFocus={!produto} />
      </Campo>
      <Campo rotulo="Código de barras">
        <input name="codigoBarras" defaultValue={produto?.codigoBarras ?? ""} className="campo" inputMode="numeric" />
      </Campo>
      <Campo rotulo="Categoria">
        <select name="categoriaId" defaultValue={produto?.categoriaId ?? ""} className="campo">
          <option value="">Sem categoria</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </Campo>
      <Campo rotulo="Unidade">
        <select name="unidade" defaultValue={produto?.unidade ?? "UN"} className="campo">
          <option value="UN">Unidade (un)</option>
          <option value="KG">Quilo (kg)</option>
          <option value="CX">Caixa (cx)</option>
          <option value="LT">Litro (lt)</option>
          <option value="PCT">Pacote (pct)</option>
        </select>
      </Campo>
      <Campo rotulo="Estoque mínimo">
        <input name="estoqueMinimo" defaultValue={produto?.estoqueMinimo ?? 0} className="campo" inputMode="decimal" />
      </Campo>
      <Campo rotulo="Preço de custo">
        <CampoMoeda name="precoCusto" defaultCentavos={produto?.precoCustoCentavos} />
      </Campo>
      <Campo rotulo="Preço de venda *">
        <CampoMoeda name="precoVenda" defaultCentavos={produto?.precoVendaCentavos} required />
      </Campo>
      {produto && (
        <Campo rotulo="Situação">
          <select name="ativo" defaultValue={produto.ativo ? "1" : "0"} className="campo">
            <option value="1">Ativo</option>
            <option value="0">Inativo (não aparece no PDV)</option>
          </select>
        </Campo>
      )}
      <div className="sm:col-span-2">
        <p className="mb-3 text-xs text-stone-500">
          O custo é atualizado automaticamente a cada entrada de estoque. Validade e quantidade são lançadas por lote em <b>Entradas</b>.
        </p>
        <Enviar>{produto ? "Salvar alterações" : "Cadastrar produto"}</Enviar>
      </div>
    </Formulario>
  );
}
