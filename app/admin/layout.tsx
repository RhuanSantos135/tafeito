import { Marca } from "@/components/marca";
import { MenuLateral } from "@/components/menu-lateral";
import { RodapeUsuario } from "@/components/rodape-usuario";
import { exigirSuperAdmin } from "@/lib/auth";
import { estiloTema, TEMA_PADRAO } from "@/lib/tema";

export const metadata = { title: { default: "Admin", template: "%s · Admin Tá Feito" } };

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const u = await exigirSuperAdmin();
  return (
    <div style={estiloTema(TEMA_PADRAO)} className="min-h-screen lg:flex">
      <MenuLateral
        cabecalho={
          <div>
            <Marca />
            <div className="mt-1 hidden text-xs text-stone-500 lg:block">Administração da plataforma</div>
          </div>
        }
        itens={[
          { href: "/admin", rotulo: "Visão geral", icone: "🏠" },
          { href: "/admin/clientes/novo", rotulo: "Nova mercearia", icone: "➕" },
          { href: "/admin/faturas", rotulo: "Faturas", icone: "💳" },
          { href: "/admin/configuracoes", rotulo: "Preços e conta", icone: "⚙️" },
        ]}
        rodape={<RodapeUsuario nome={u.nome} papel={u.papel} />}
      />
      <main className="mx-auto min-w-0 max-w-7xl flex-1 p-4 lg:p-8">{children}</main>
    </div>
  );
}
