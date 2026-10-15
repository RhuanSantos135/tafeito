/** Logotipo padrão "Tá Feito". */
export function Marca({ grande = false, clara = false }: { grande?: boolean; clara?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold tracking-tight ${grande ? "text-3xl" : "text-lg"} ${clara ? "text-white" : "text-stone-900"}`}>
      <span className={`grid place-items-center rounded-lg bg-primaria text-white ${grande ? "h-11 w-11 text-2xl" : "h-8 w-8 text-base"}`}>✓</span>
      Tá Feito
    </span>
  );
}
