import { sair } from "@/app/login/actions";

export function RodapeUsuario({ nome, papel }: { nome: string; papel: string }) {
  const rotulo = { SUPERADMIN: "Administrador da plataforma", ADMIN: "Administrador", OPERADOR: "Operador de caixa" }[papel] ?? papel;
  return (
    <div className="flex items-center justify-between gap-2 px-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{nome}</div>
        <div className="text-xs text-stone-500">{rotulo}</div>
      </div>
      <form action={sair}>
        <button className="btn-secundario btn-sm" title="Sair">Sair</button>
      </form>
    </div>
  );
}
