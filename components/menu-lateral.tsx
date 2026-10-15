"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type ItemMenu = { href: string; rotulo: string; icone: string; grupo?: string };

export function MenuLateral({ itens, cabecalho, rodape }: { itens: ItemMenu[]; cabecalho: React.ReactNode; rodape: React.ReactNode }) {
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);
  const ativo = (href: string) => caminho === href || (href !== "/" && href !== "/admin" && caminho.startsWith(href + "/"));

  let grupoAnterior: string | undefined;
  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3 print:hidden lg:hidden">
        {cabecalho}
        <button onClick={() => setAberto(!aberto)} className="btn-secundario btn-sm" aria-label="Abrir menu">
          ☰
        </button>
      </div>
      {aberto && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setAberto(false)} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col print:hidden border-r border-stone-200 bg-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${aberto ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="border-b border-stone-100 px-5 py-4">{cabecalho}</div>
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {itens.map((i) => {
            const titulo = i.grupo && i.grupo !== grupoAnterior ? i.grupo : null;
            grupoAnterior = i.grupo;
            return (
              <div key={i.href}>
                {titulo && <div className="mt-4 mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-stone-400">{titulo}</div>}
                <Link
                  href={i.href}
                  onClick={() => setAberto(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${ativo(i.href) ? "bg-primaria/10 text-primaria" : "text-stone-600 hover:bg-stone-100"}`}
                >
                  <span className="w-5 text-center">{i.icone}</span>
                  {i.rotulo}
                </Link>
              </div>
            );
          })}
        </nav>
        <div className="border-t border-stone-100 p-3">{rodape}</div>
      </aside>
    </>
  );
}
