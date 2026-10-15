import { reais } from "@/lib/formato";

/** Barras verticais de uma série (faturamento por dia), com tooltip ao passar o mouse. */
export function GraficoBarras({ dados }: { dados: { dia: string; total: number; qtd: number }[] }) {
  const max = Math.max(...dados.map((d) => d.total), 1);
  const rotulo = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
  return (
    <figure>
      <div className="relative flex h-48 items-end gap-[2px] border-b border-stone-200">
        {dados.map((d) => (
          <div key={d.dia} className="group relative flex h-full flex-1 items-end">
            <div
              className="w-full rounded-t-[4px] bg-primaria/80 transition group-hover:bg-primaria"
              style={{ height: `${Math.max((d.total / max) * 100, d.total ? 1 : 0)}%` }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-stone-900 px-2 py-1 text-xs text-white shadow group-hover:block">
              <b>{rotulo(d.dia)}</b> · {reais(d.total)} · {d.qtd} venda(s)
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-stone-400">
        <span>{rotulo(dados[0].dia)}</span>
        <span>{rotulo(dados[Math.floor(dados.length / 2)].dia)}</span>
        <span>{rotulo(dados[dados.length - 1].dia)}</span>
      </div>
      <figcaption className="sr-only">
        {dados.map((d) => `${rotulo(d.dia)}: ${reais(d.total)}`).join("; ")}
      </figcaption>
    </figure>
  );
}
