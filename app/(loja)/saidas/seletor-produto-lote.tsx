"use client";

import { useState } from "react";

type Opcao = { id: number; nome: string; unidade: string; saldo: number };
type Lote = { id: number; produtoId: number; rotulo: string };

/** Escolhe o produto e, opcionalmente, o lote de onde a saída vai sair. */
export function SeletorProdutoLote({ produtos, lotes, comLote = true }: { produtos: Opcao[]; lotes: Lote[]; comLote?: boolean }) {
  const [produto, setProduto] = useState("");
  const doProduto = lotes.filter((l) => String(l.produtoId) === produto);
  return (
    <>
      <label className="block">
        <span className="rotulo">Produto *</span>
        <select name="produtoId" value={produto} onChange={(e) => setProduto(e.target.value)} className="campo" required>
          <option value="">Selecione…</option>
          {produtos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome} — saldo {p.saldo} {p.unidade.toLowerCase()}
            </option>
          ))}
        </select>
      </label>
      {comLote && (
        <label className="block">
          <span className="rotulo">Lote</span>
          <select name="loteId" className="campo" disabled={!doProduto.length}>
            <option value="">Automático (vence primeiro sai primeiro)</option>
            {doProduto.map((l) => (
              <option key={l.id} value={l.id}>{l.rotulo}</option>
            ))}
          </select>
        </label>
      )}
    </>
  );
}
