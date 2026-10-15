"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef } from "react";

export type EstadoAcao = { erro?: string; ok?: string; t?: number } | null;
export type Acao = (prev: EstadoAcao, dados: FormData) => Promise<EstadoAcao>;

const Pendente = createContext(false);

/**
 * Formulário ligado a uma server action, com mensagens de erro/sucesso.
 * Submete via onSubmit (e não pelo atributo action) para o React não limpar os campos
 * quando a action retorna erro — só limpamos se `limparAoSalvar` e deu certo.
 */
export function Formulario({
  acao,
  children,
  className = "",
  limparAoSalvar = false,
  confirmar,
}: {
  acao: Acao;
  children: React.ReactNode;
  className?: string;
  limparAoSalvar?: boolean;
  confirmar?: string;
}) {
  const [estado, executar, pendente] = useActionState(acao, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado?.ok && limparAoSalvar) ref.current?.reset();
  }, [estado, limparAoSalvar]);

  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (pendente) return;
        if (confirmar && !window.confirm(confirmar)) return;
        const dados = new FormData(e.currentTarget);
        startTransition(() => executar(dados));
      }}
    >
      <Pendente.Provider value={pendente}>{children}</Pendente.Provider>
      {estado?.erro && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{estado.erro}</p>}
      {estado?.ok && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{estado.ok}</p>}
    </form>
  );
}

export function Enviar({ children, className = "btn-primario" }: { children: React.ReactNode; className?: string }) {
  const pendente = useContext(Pendente);
  return (
    <button type="submit" disabled={pendente} className={className}>
      {pendente ? "Salvando…" : children}
    </button>
  );
}
