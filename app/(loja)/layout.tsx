import { eq } from "drizzle-orm";
import { Marca } from "@/components/marca";
import { type ItemMenu, MenuLateral } from "@/components/menu-lateral";
import { RodapeUsuario } from "@/components/rodape-usuario";
import { tenants } from "@/db/schema";
import { exigirTenant } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { estiloTema, resolverTema } from "@/lib/tema";

const MENU: (ItemMenu & { admin?: boolean })[] = [
  { href: "/", rotulo: "Dashboard", icone: "📊" },
  { href: "/pdv", rotulo: "Vender (PDV)", icone: "🛒" },
  { href: "/vendas", rotulo: "Vendas", icone: "🗂️" },
  { href: "/produtos", rotulo: "Produtos", icone: "📦", grupo: "Estoque" },
  { href: "/estoque", rotulo: "Saldo e movimentações", icone: "📋", grupo: "Estoque" },
  { href: "/entradas", rotulo: "Entradas", icone: "📥", grupo: "Estoque" },
  { href: "/saidas", rotulo: "Saídas e ajustes", icone: "📤", grupo: "Estoque" },
  { href: "/vencimentos", rotulo: "Vencimentos", icone: "⏰", grupo: "Estoque" },
  { href: "/clientes", rotulo: "Clientes", icone: "👥", grupo: "Fiado" },
  { href: "/contas", rotulo: "Contas a receber", icone: "💰", grupo: "Fiado" },
  { href: "/contas-pagar", rotulo: "Contas a pagar", icone: "🧾", grupo: "Financeiro", admin: true },
  { href: "/fornecedores", rotulo: "Fornecedores", icone: "🚚", grupo: "Cadastros" },
  { href: "/categorias", rotulo: "Categorias", icone: "🏷️", grupo: "Cadastros" },
  { href: "/configuracoes", rotulo: "Configurações", icone: "⚙️", grupo: "Cadastros", admin: true },
];

export default async function LayoutLoja({ children }: { children: React.ReactNode }) {
  const u = await exigirTenant();
  const db = await getDb();
  const [t] = await db.select().from(tenants).where(eq(tenants.id, u.tenantId));
  const tema = resolverTema(t);
  const itens = MENU.filter((m) => !m.admin || u.papel === "ADMIN");

  const cabecalho = (
    <div className="flex min-w-0 items-center gap-2">
      {tema.logoUrl ? <img src={tema.logoUrl} alt="" className="h-8 w-auto max-w-[120px] object-contain" /> : <Marca />}
      <span className="truncate text-xs text-stone-500 lg:hidden">{t.nome}</span>
    </div>
  );

  return (
    <div style={estiloTema(tema)} className="min-h-screen lg:flex">
      <MenuLateral
        itens={itens}
        cabecalho={
          <div>
            {cabecalho}
            <div className="mt-1 hidden truncate text-xs text-stone-500 lg:block">{t.nome}</div>
          </div>
        }
        rodape={<RodapeUsuario nome={u.nome} papel={u.papel} />}
      />
      <div
        className="min-w-0 flex-1 bg-cover bg-fixed bg-center"
        style={tema.fundoUrl ? { backgroundImage: `linear-gradient(rgba(245,245,244,.88), rgba(245,245,244,.88)), url("${tema.fundoUrl}")` } : undefined}
      >
        <main className="mx-auto max-w-7xl p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
