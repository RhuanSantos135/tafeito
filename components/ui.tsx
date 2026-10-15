import Link from "next/link";

export function Cabecalho({ titulo, descricao, acoes }: { titulo: string; descricao?: string; acoes?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-stone-500">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

export function Cartao({ titulo, acoes, children, className = "" }: { titulo?: React.ReactNode; acoes?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`cartao ${className}`}>
      {titulo && (
        <header className="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
          <h2 className="text-sm font-semibold">{titulo}</h2>
          {acoes}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Indicador({ rotulo, valor, detalhe, tom = "normal" }: { rotulo: string; valor: React.ReactNode; detalhe?: React.ReactNode; tom?: "normal" | "alerta" | "perigo" | "ok" }) {
  const cores = { normal: "text-stone-900", alerta: "text-amber-600", perigo: "text-red-600", ok: "text-primaria" };
  return (
    <div className="cartao p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-stone-500">{rotulo}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${cores[tom]}`}>{valor}</div>
      {detalhe && <div className="mt-1 text-xs text-stone-500">{detalhe}</div>}
    </div>
  );
}

const TONS = {
  cinza: "bg-stone-100 text-stone-700",
  verde: "bg-emerald-100 text-emerald-800",
  amarelo: "bg-amber-100 text-amber-800",
  vermelho: "bg-red-100 text-red-800",
  azul: "bg-sky-100 text-sky-800",
};

export function Selo({ tom = "cinza", children }: { tom?: keyof typeof TONS; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONS[tom]}`}>{children}</span>;
}

export function Vazio({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-stone-400">{children}</p>;
}

export function TabelaRolavel({ children }: { children: React.ReactNode }) {
  return <div className="-mx-4 -my-4 overflow-x-auto">{children}</div>;
}

export function Campo({ rotulo, children, className = "" }: { rotulo: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="rotulo">{rotulo}</span>
      {children}
    </label>
  );
}

export function Abas({ itens, atual }: { itens: { href: string; rotulo: string; chave: string }[]; atual: string }) {
  return (
    <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-stone-200/60 p-1 text-sm">
      {itens.map((i) => (
        <Link
          key={i.chave}
          href={i.href}
          className={`rounded-md px-3 py-1.5 font-medium ${i.chave === atual ? "bg-white shadow-sm" : "text-stone-600 hover:text-stone-900"}`}
        >
          {i.rotulo}
        </Link>
      ))}
    </div>
  );
}
