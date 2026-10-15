"use client";

import { useEffect, useRef } from "react";

/** Botão que abre um painel flutuante; fecha ao clicar fora, com Esc ou no botão Cancelar. */
export function Popover({ rotulo, children, className = "btn-primario btn-sm" }: { rotulo: React.ReactNode; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const fechar = () => {
      if (ref.current) ref.current.open = false;
    };
    const aoClicar = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) fechar();
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };
    document.addEventListener("mousedown", aoClicar);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicar);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, []);

  return (
    <details ref={ref} className="relative" data-popover>
      <summary
        className={`${className} cursor-pointer list-none`}
        onClick={() => {
          // Só um painel aberto por vez: ao abrir este, fecha os outros
          if (!ref.current?.open) document.querySelectorAll("details[data-popover][open]").forEach((d) => d !== ref.current && d.removeAttribute("open"));
        }}
      >
        {rotulo}
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-72 rounded-xl border border-stone-200 bg-white p-3 text-left shadow-xl">
        {children}
        <button type="button" onClick={() => ref.current && (ref.current.open = false)} className="btn-secundario btn-sm mt-2 w-full">
          Cancelar
        </button>
      </div>
    </details>
  );
}
