"use client";

import { useEffect, useRef, useState } from "react";

const formatar = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Campo de valor em reais com máscara: os dígitos entram pela direita
 * (digitar 1, 2, 5, 0 mostra 0,01 → 0,12 → 1,25 → 12,50).
 * Envia o texto formatado ("1.234,56"), que o servidor converte com paraCentavos.
 */
export function CampoMoeda({
  name,
  defaultCentavos,
  required,
  placeholder = "0,00",
  className = "",
  autoFocus,
}: {
  name: string;
  /** Valor inicial em centavos; null/undefined deixa o campo vazio */
  defaultCentavos?: number | null;
  required?: boolean;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const inicial = defaultCentavos == null ? "" : formatar(defaultCentavos);
  const [valor, setValor] = useState(inicial);
  const ref = useRef<HTMLInputElement>(null);

  // Acompanha o reset do formulário (ex.: limpar após salvar)
  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const aoResetar = () => setValor(inicial);
    form.addEventListener("reset", aoResetar);
    return () => form.removeEventListener("reset", aoResetar);
  }, [inicial]);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-stone-400">R$</span>
      <input
        ref={ref}
        name={name}
        value={valor}
        onChange={(e) => {
          const digitos = e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 11);
          setValor(digitos ? formatar(Number(digitos)) : "");
        }}
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        className={`campo pl-9 text-right tabular-nums ${className}`}
      />
    </div>
  );
}
