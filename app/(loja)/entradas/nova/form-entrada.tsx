"use client";

import { useMemo, useState } from "react";
import { Enviar, Formulario } from "@/components/formulario";
import { reais } from "@/lib/formato";
import { salvarEntrada } from "../actions";

type Produto = { id: number; nome: string; codigoBarras: string | null; unidade: string; precoCustoCentavos: number };
type Linha = { chave: number; produtoId: number; quantidade: string; custo: string; validade: string; codigoLote: string };

const num = (s: string) => Number(s.replace(",", ".")) || 0;

export function FormEntrada({
  produtos,
  fornecedores,
  hoje,
  vencimentoPadrao,
  podeLancarConta,
}: {
  produtos: Produto[];
  fornecedores: { id: number; nome: string }[];
  hoje: string;
  vencimentoPadrao: string;
  podeLancarConta: boolean;
}) {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [gerarConta, setGerarConta] = useState(podeLancarConta);
  const [busca, setBusca] = useState("");
  const porId = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);

  const sugestoes = busca.trim()
    ? produtos.filter((p) => p.nome.toLowerCase().includes(busca.toLowerCase()) || p.codigoBarras === busca.trim()).slice(0, 8)
    : [];

  function adicionar(p: Produto) {
    setLinhas((ls) => [...ls, { chave: Date.now(), produtoId: p.id, quantidade: "", custo: (p.precoCustoCentavos / 100).toFixed(2).replace(".", ","), validade: "", codigoLote: "" }]);
    setBusca("");
  }
  const alterar = (chave: number, campo: keyof Linha, valor: string) => setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, [campo]: valor } : l)));

  const total = linhas.reduce((s, l) => s + Math.round(num(l.quantidade) * num(l.custo) * 100), 0);
  const itensJson = JSON.stringify(
    linhas.map((l) => ({ produtoId: l.produtoId, quantidade: num(l.quantidade), custoUnitarioCentavos: Math.round(num(l.custo) * 100), validade: l.validade || null, codigoLote: l.codigoLote || null })),
  );

  return (
    <Formulario acao={salvarEntrada} className="space-y-6">
      <input type="hidden" name="itens" value={itensJson} />
      <div className="grid gap-4 sm:grid-cols-4">
        <label className="block sm:col-span-2">
          <span className="rotulo">Fornecedor</span>
          <select name="fornecedorId" className="campo">
            <option value="">—</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="rotulo">Nota fiscal</span>
          <input name="notaFiscal" className="campo" />
        </label>
        <label className="block">
          <span className="rotulo">Data</span>
          <input name="data" type="date" defaultValue={hoje} className="campo" />
        </label>
      </div>

      <div className="relative">
        <span className="rotulo">Adicionar produto</span>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (sugestoes[0]) adicionar(sugestoes[0]);
            }
          }}
          placeholder="Bipe o código de barras ou digite o nome"
          className="campo"
        />
        {sugestoes.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg">
            {sugestoes.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => adicionar(p)} className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-stone-50">
                  <span>{p.nome}</span>
                  <span className="text-stone-400">{p.codigoBarras}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="-mx-4 overflow-x-auto">
        <table className="tabela">
          <thead>
            <tr>
              <th>Produto</th>
              <th className="w-28">Quantidade</th>
              <th className="w-32">Custo unit. (R$)</th>
              <th className="w-40">Validade</th>
              <th className="w-28">Lote</th>
              <th className="w-28 text-right">Subtotal</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-stone-400">Nenhum item adicionado.</td>
              </tr>
            )}
            {linhas.map((l) => {
              const p = porId.get(l.produtoId)!;
              return (
                <tr key={l.chave}>
                  <td className="font-medium">
                    {p.nome} <span className="text-xs text-stone-400">({p.unidade.toLowerCase()})</span>
                  </td>
                  <td><input value={l.quantidade} onChange={(e) => alterar(l.chave, "quantidade", e.target.value)} className="campo py-1" inputMode="decimal" required /></td>
                  <td><input value={l.custo} onChange={(e) => alterar(l.chave, "custo", e.target.value)} className="campo py-1" inputMode="decimal" /></td>
                  <td><input type="date" value={l.validade} onChange={(e) => alterar(l.chave, "validade", e.target.value)} className="campo py-1" /></td>
                  <td><input value={l.codigoLote} onChange={(e) => alterar(l.chave, "codigoLote", e.target.value)} className="campo py-1" /></td>
                  <td className="text-right tabular-nums">{reais(Math.round(num(l.quantidade) * num(l.custo) * 100))}</td>
                  <td>
                    <button type="button" onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))} className="text-stone-400 hover:text-red-600" aria-label="Remover">✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <label className="block">
        <span className="rotulo">Observação</span>
        <input name="observacao" className="campo" />
      </label>

      {podeLancarConta && (
        <fieldset className="rounded-lg border border-stone-200 p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="gerarConta" value="1" checked={gerarConta} onChange={(e) => setGerarConta(e.target.checked)} />
            Lançar em contas a pagar (boleto do fornecedor)
          </label>
          {gerarConta && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="rotulo">1º vencimento</span>
                <input name="contaVencimento" type="date" defaultValue={vencimentoPadrao} className="campo" />
              </label>
              <label className="block">
                <span className="rotulo">Parcelas</span>
                <input name="contaParcelas" type="number" min={1} max={12} defaultValue={1} className="campo" />
              </label>
              <label className="block">
                <span className="rotulo">Intervalo (dias)</span>
                <input name="contaIntervalo" type="number" min={1} max={120} defaultValue={30} className="campo" />
              </label>
            </div>
          )}
        </fieldset>
      )}

      <div className="flex items-center justify-between border-t border-stone-100 pt-4">
        <div className="text-lg font-semibold">Total: <span className="tabular-nums">{reais(total)}</span></div>
        <Enviar>Registrar entrada</Enviar>
      </div>
    </Formulario>
  );
}
