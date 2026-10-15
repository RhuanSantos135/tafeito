"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { centavosParaInput, paraCentavos, qtd, reais, ROTULO_PAGAMENTO } from "@/lib/formato";
import type { SituacaoCredito } from "@/lib/servicos/vendas";
import { consultarCredito, finalizarVenda, type PayloadVenda } from "./actions";

type Produto = { id: number; nome: string; codigoBarras: string | null; unidade: string; preco: number; saldo: number };
type Cliente = { id: number; nome: string; telefone: string | null };
type Item = { produto: Produto; quantidade: string; desconto: string };
type Forma = PayloadVenda["formaPagamento"];

const FORMAS: Forma[] = ["DINHEIRO", "PIX", "DEBITO", "CREDITO", "PRAZO"];
const num = (s: string) => Number(String(s).replace(",", ".")) || 0;

export function Caixa({ produtos, clientes }: { produtos: Produto[]; clientes: Cliente[] }) {
  const [busca, setBusca] = useState("");
  const [itens, setItens] = useState<Item[]>([]);
  const [desconto, setDesconto] = useState("");
  const [forma, setForma] = useState<Forma>("DINHEIRO");
  const [recebido, setRecebido] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [credito, setCredito] = useState<SituacaoCredito | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [concluida, setConcluida] = useState<{ vendaId: number; total: number; troco: number | null } | null>(null);
  const [pendente, iniciar] = useTransition();
  const buscaRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const porCodigo = useMemo(() => new Map(produtos.filter((p) => p.codigoBarras).map((p) => [p.codigoBarras!, p])), [produtos]);
  const termo = busca.replace(/^\d+([.,]\d+)?\*/, "").trim().toLowerCase();
  const sugestoes = termo ? produtos.filter((p) => p.nome.toLowerCase().includes(termo) || p.codigoBarras?.startsWith(termo)).slice(0, 8) : [];

  const linhas = itens.map((i) => {
    const bruto = Math.round(i.produto.preco * num(i.quantidade));
    const desc = Math.min(paraCentavos(i.desconto), bruto);
    return { ...i, bruto, desc, total: bruto - desc };
  });
  const subtotal = linhas.reduce((s, l) => s + l.total, 0);
  const descontoGeral = Math.min(paraCentavos(desconto), subtotal);
  const total = subtotal - descontoGeral;
  const recebidoCent = paraCentavos(recebido);
  const troco = forma === "DINHEIRO" && recebido ? recebidoCent - total : null;

  useEffect(() => {
    if (!clienteId) return setCredito(null);
    consultarCredito(Number(clienteId)).then(setCredito);
  }, [clienteId]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        buscaRef.current?.focus();
      }
      if (e.key === "F4") {
        e.preventDefault();
        finalizar();
      }
      if (e.key === "Escape" && concluida) novaVenda();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  function adicionar(p: Produto, quantidade = 1) {
    setErro(null);
    setItens((atual) => {
      const existente = atual.find((i) => i.produto.id === p.id);
      if (existente) return atual.map((i) => (i.produto.id === p.id ? { ...i, quantidade: String(num(i.quantidade) + quantidade) } : i));
      return [...atual, { produto: p, quantidade: String(quantidade), desconto: "" }];
    });
    setBusca("");
    buscaRef.current?.focus();
  }

  function aoBipar() {
    // Aceita "3*7891234567890" para multiplicar a quantidade
    const m = busca.match(/^(\d+(?:[.,]\d+)?)\*(.*)$/);
    const quantidade = m ? num(m[1]) : 1;
    const codigo = (m ? m[2] : busca).trim();
    const p = porCodigo.get(codigo) ?? (sugestoes.length === 1 ? sugestoes[0] : null);
    if (p) adicionar(p, quantidade);
    else if (sugestoes[0]) adicionar(sugestoes[0], quantidade);
    else setErro(`Produto "${codigo}" não encontrado.`);
  }

  const alterar = (id: number, campo: "quantidade" | "desconto", v: string) => setItens((is) => is.map((i) => (i.produto.id === id ? { ...i, [campo]: v } : i)));

  function novaVenda() {
    setItens([]);
    setDesconto("");
    setRecebido("");
    setClienteId("");
    setForma("DINHEIRO");
    setConcluida(null);
    setErro(null);
    setTimeout(() => buscaRef.current?.focus(), 0);
  }

  function finalizar() {
    if (pendente || concluida) return;
    if (!itens.length) return setErro("Adicione produtos ao carrinho.");
    if (forma === "PRAZO" && !clienteId) return setErro("Selecione o cliente para vender a prazo.");
    if (forma === "DINHEIRO" && recebido && recebidoCent < total) return setErro("Valor recebido menor que o total.");
    setErro(null);
    iniciar(async () => {
      const r = await finalizarVenda({
        itens: linhas.map((l) => ({ produtoId: l.produto.id, quantidade: num(l.quantidade), descontoCentavos: l.desc })),
        descontoCentavos: descontoGeral,
        formaPagamento: forma,
        clienteId: clienteId ? Number(clienteId) : null,
        valorRecebidoCentavos: forma === "DINHEIRO" && recebido ? recebidoCent : null,
        vencimento: null,
      });
      if ("erro" in r) setErro(r.erro);
      else {
        setConcluida(r);
        router.refresh(); // atualiza o saldo dos produtos exibido no caixa
      }
    });
  }

  const bloqueioPrazo = forma === "PRAZO" && credito && (credito.bloqueado || total > credito.disponivelCentavos);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      {/* Carrinho */}
      <section className="cartao flex min-h-[70vh] flex-col">
        <div className="relative border-b border-stone-100 p-4">
          <input
            ref={buscaRef}
            autoFocus
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (busca.trim()) aoBipar();
              }
            }}
            placeholder="Bipe o código de barras ou busque pelo nome (F2)  ·  ex.: 3*789123…"
            className="campo py-3 text-base"
          />
          {sugestoes.length > 0 && !porCodigo.has(termo) && (
            <ul className="absolute inset-x-4 z-10 mt-1 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg">
              {sugestoes.map((p) => (
                <li key={p.id}>
                  <button onClick={() => adicionar(p)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-stone-50">
                    <span>
                      {p.nome} <span className="text-xs text-stone-400">{p.codigoBarras}</span>
                    </span>
                    <span className="whitespace-nowrap">
                      <span className={`mr-3 text-xs ${p.saldo <= 0 ? "text-red-500" : "text-stone-400"}`}>estoque {qtd(p.saldo, p.unidade)}</span>
                      <b className="tabular-nums">{reais(p.preco)}</b>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex-1 overflow-x-auto">
          {itens.length === 0 ? (
            <div className="grid h-full place-items-center p-10 text-center text-stone-400">
              <div>
                <div className="text-5xl">🛒</div>
                <p className="mt-2">Caixa livre. Bipe um produto para começar.</p>
              </div>
            </div>
          ) : (
            <table className="tabela">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th className="w-24">Qtd</th>
                  <th className="w-24 text-right">Unit.</th>
                  <th className="w-24">Desc. R$</th>
                  <th className="w-28 text-right">Total</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.produto.id}>
                    <td>
                      <div className="font-medium">{l.produto.nome}</div>
                      {num(l.quantidade) > l.produto.saldo && <div className="text-xs text-amber-600">Estoque no sistema: {qtd(l.produto.saldo, l.produto.unidade)}</div>}
                    </td>
                    <td>
                      <input value={l.quantidade} onChange={(e) => alterar(l.produto.id, "quantidade", e.target.value)} className="campo px-2 py-1" inputMode="decimal" aria-label="Quantidade" />
                    </td>
                    <td className="text-right tabular-nums">{reais(l.produto.preco)}</td>
                    <td>
                      <input value={l.desconto} onChange={(e) => alterar(l.produto.id, "desconto", e.target.value)} className="campo px-2 py-1" inputMode="decimal" placeholder="0,00" aria-label="Desconto do item" />
                    </td>
                    <td className="text-right font-medium tabular-nums">{reais(l.total)}</td>
                    <td>
                      <button onClick={() => setItens((is) => is.filter((i) => i.produto.id !== l.produto.id))} className="text-stone-400 hover:text-red-600" aria-label="Remover">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-stone-100 px-4 py-3 text-sm text-stone-500">
          <span>{itens.length} item(ns)</span>
          {itens.length > 0 && <button onClick={() => setItens([])} className="hover:text-red-600">Limpar carrinho</button>}
        </div>
      </section>

      {/* Pagamento */}
      <aside className="cartao flex flex-col gap-4 p-4">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-stone-500">Subtotal</span><span className="tabular-nums">{reais(subtotal)}</span></div>
          <label className="flex items-center justify-between gap-2">
            <span className="text-stone-500">Desconto (R$)</span>
            <input value={desconto} onChange={(e) => setDesconto(e.target.value)} className="campo w-28 py-1 text-right" inputMode="decimal" placeholder="0,00" />
          </label>
        </div>
        <div className="rounded-xl bg-primaria px-4 py-3 text-white">
          <div className="text-xs uppercase tracking-wider opacity-80">Total a pagar</div>
          <div className="text-4xl font-bold tabular-nums">{reais(total)}</div>
        </div>

        <div>
          <span className="rotulo">Forma de pagamento</span>
          <div className="grid grid-cols-2 gap-2">
            {FORMAS.map((f) => (
              <button
                key={f}
                onClick={() => setForma(f)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${forma === f ? "border-primaria bg-primaria/10 text-primaria" : "border-stone-200 hover:bg-stone-50"} ${f === "PRAZO" ? "col-span-2" : ""}`}
              >
                {ROTULO_PAGAMENTO[f]}
              </button>
            ))}
          </div>
        </div>

        {forma === "DINHEIRO" && (
          <div className="space-y-2">
            <label className="block">
              <span className="rotulo">Valor recebido (R$)</span>
              <input value={recebido} onChange={(e) => setRecebido(e.target.value)} className="campo text-lg" inputMode="decimal" placeholder={centavosParaInput(total)} />
            </label>
            {troco !== null && (
              <div className={`flex justify-between rounded-lg px-3 py-2 text-lg font-semibold ${troco < 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>
                <span>{troco < 0 ? "Falta" : "Troco"}</span>
                <span className="tabular-nums">{reais(Math.abs(troco))}</span>
              </div>
            )}
          </div>
        )}

        <label className="block">
          <span className="rotulo">Cliente {forma === "PRAZO" ? "*" : "(opcional)"}</span>
          <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="campo">
            <option value="">Consumidor não identificado</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </label>

        {forma === "PRAZO" && credito && (
          <div className={`rounded-lg p-3 text-sm ${bloqueioPrazo ? "bg-red-50 text-red-800" : "bg-stone-50"}`}>
            <div className="flex justify-between"><span>Limite</span><span className="tabular-nums">{reais(credito.limiteCentavos)}</span></div>
            <div className="flex justify-between"><span>Em aberto</span><span className="tabular-nums">{reais(credito.devedorCentavos)}</span></div>
            <div className="flex justify-between font-semibold"><span>Disponível</span><span className="tabular-nums">{reais(credito.disponivelCentavos)}</span></div>
            {credito.bloqueado && <p className="mt-2 font-semibold">⛔ {credito.motivoBloqueio}</p>}
            {!credito.bloqueado && total > credito.disponivelCentavos && <p className="mt-2 font-semibold">⛔ Total acima do crédito disponível</p>}
          </div>
        )}

        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

        <button onClick={finalizar} disabled={pendente || !itens.length || !!bloqueioPrazo} className="btn-primario mt-auto py-3 text-base">
          {pendente ? "Registrando…" : "Finalizar venda (F4)"}
        </button>
      </aside>

      {concluida && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primaria text-2xl text-white">✓</div>
            <h2 className="mt-3 text-xl font-bold">Tá feito! Venda #{concluida.vendaId}</h2>
            <p className="mt-1 text-stone-500">Total {reais(concluida.total)}</p>
            {concluida.troco ? <p className="mt-3 rounded-lg bg-emerald-50 py-2 text-2xl font-bold text-emerald-800">Troco {reais(concluida.troco)}</p> : null}
            <div className="mt-6 flex gap-2">
              <Link href={`/vendas/${concluida.vendaId}`} className="btn-secundario flex-1">Ver comprovante</Link>
              <button onClick={novaVenda} autoFocus className="btn-primario flex-1">Nova venda (Esc)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
