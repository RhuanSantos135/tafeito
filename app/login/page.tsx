import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Enviar, Formulario } from "@/components/formulario";
import { Marca } from "@/components/marca";
import { tenants } from "@/db/schema";
import { usuarioAtual } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { estiloTema, resolverTema } from "@/lib/tema";
import { entrar } from "./actions";

export const metadata = { title: "Entrar" };

export default async function Login({ searchParams }: { searchParams: Promise<{ loja?: string }> }) {
  const u = await usuarioAtual();
  if (u) redirect(u.papel === "SUPERADMIN" ? "/admin" : "/");

  const { loja } = await searchParams;
  const db = await getDb();
  const [t] = loja ? await db.select().from(tenants).where(eq(tenants.slug, loja)) : [];
  const tema = resolverTema(t);

  return (
    <main
      style={{
        ...estiloTema(tema),
        backgroundImage: tema.fundoUrl
          ? `linear-gradient(rgba(0,0,0,.35), rgba(0,0,0,.35)), url("${tema.fundoUrl}")`
          : "radial-gradient(circle at 20% 20%, var(--secundaria) 0, transparent 40%), linear-gradient(135deg, var(--primaria), #0f172a)",
      }}
      className="flex min-h-screen items-center justify-center bg-cover bg-center p-4"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white/95 p-8 shadow-2xl backdrop-blur">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          {tema.logoUrl ? <img src={tema.logoUrl} alt="" className="h-16 w-auto object-contain" /> : <Marca grande />}
          {t && <p className="text-sm font-medium text-stone-600">{t.nome}</p>}
        </div>
        <Formulario acao={entrar} className="space-y-4">
          <label className="block">
            <span className="rotulo">E-mail</span>
            <input name="email" type="email" required autoComplete="username" className="campo" autoFocus />
          </label>
          <label className="block">
            <span className="rotulo">Senha</span>
            <input name="senha" type="password" required autoComplete="current-password" className="campo" />
          </label>
          <Enviar className="btn-primario w-full">Entrar</Enviar>
        </Formulario>
      </div>
    </main>
  );
}
