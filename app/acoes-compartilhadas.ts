"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { EstadoAcao } from "@/components/formulario";
import { tenants, usuarios } from "@/db/schema";
import { inteiro, tentar, texto } from "@/lib/acao";
import { usuarioAtual } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { gerarHashSenha } from "@/lib/senha";
import { ErroNegocio } from "@/lib/servicos/estoque";

const MAX_IMAGEM = 700 * 1024; // linhas do D1 têm limite de ~2MB; imagens maiores devem ir para R2
const COR = /^#[0-9a-fA-F]{6}$/;

/** Só o super admin ou o admin da própria mercearia podem alterar a mercearia. */
async function autorizar(tenantId: number) {
  const u = await usuarioAtual();
  if (!u) throw new ErroNegocio("Sessão expirada.");
  if (u.papel === "SUPERADMIN") return u;
  if (u.papel === "ADMIN" && u.tenantId === tenantId) return u;
  throw new ErroNegocio("Sem permissão.");
}

async function imagem(fd: FormData, campo: string): Promise<string | null | undefined> {
  if (fd.get(`${campo}Remover`) === "1") return null;
  const arq = fd.get(`${campo}Arquivo`);
  if (arq instanceof File && arq.size > 0) {
    if (!arq.type.startsWith("image/")) throw new ErroNegocio("Envie um arquivo de imagem.");
    if (arq.size > MAX_IMAGEM) throw new ErroNegocio("Imagem muito grande (máx. 700 KB). Comprima antes de enviar.");
    const bytes = new Uint8Array(await arq.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:${arq.type};base64,${btoa(bin)}`;
  }
  const url = texto(fd, `${campo}Url`);
  if (url) {
    if (!/^https:\/\//.test(url)) throw new ErroNegocio("A URL da imagem deve começar com https://");
    return url;
  }
  return undefined; // sem alteração
}

export async function salvarTema(_: EstadoAcao, fd: FormData) {
  return tentar(async () => {
    const tenantId = inteiro(fd, "tenantId");
    if (!tenantId) throw new ErroNegocio("Mercearia inválida.");
    await autorizar(tenantId);
    const db = await getDb();
    if (fd.get("restaurar") === "1") {
      await db.update(tenants).set({ corPrimaria: null, corSecundaria: null, fundoUrl: null, logoUrl: null }).where(eq(tenants.id, tenantId));
    } else {
      const primaria = texto(fd, "corPrimaria");
      const secundaria = texto(fd, "corSecundaria");
      if ((primaria && !COR.test(primaria)) || (secundaria && !COR.test(secundaria))) throw new ErroNegocio("Cor inválida.");
      const fundo = await imagem(fd, "fundo");
      const logo = await imagem(fd, "logo");
      await db
        .update(tenants)
        .set({
          corPrimaria: primaria,
          corSecundaria: secundaria,
          ...(fundo !== undefined && { fundoUrl: fundo }),
          ...(logo !== undefined && { logoUrl: logo }),
        })
        .where(eq(tenants.id, tenantId));
    }
    revalidatePath("/", "layout");
    return { ok: "Aparência atualizada.", t: Date.now() };
  });
}

export async function salvarUsuario(_: EstadoAcao, fd: FormData) {
  return tentar(async () => {
    const tenantId = inteiro(fd, "tenantId");
    if (!tenantId) throw new ErroNegocio("Mercearia inválida.");
    const quem = await autorizar(tenantId);
    const db = await getDb();
    const id = inteiro(fd, "id");
    const papel = fd.get("papel") === "ADMIN" ? "ADMIN" : "OPERADOR";
    const senha = String(fd.get("senha") ?? "");
    if (senha && senha.length < 6) throw new ErroNegocio("A senha deve ter ao menos 6 caracteres.");

    if (id) {
      if (id === quem.id && (papel !== "ADMIN" || fd.get("ativo") === "0")) throw new ErroNegocio("Você não pode rebaixar ou desativar a si mesmo.");
      await db
        .update(usuarios)
        .set({
          nome: texto(fd, "nome") ?? undefined,
          papel,
          ativo: fd.get("ativo") !== "0",
          ...(senha && { senhaHash: await gerarHashSenha(senha) }),
        })
        .where(and(eq(usuarios.id, id), eq(usuarios.tenantId, tenantId)));
      revalidatePath("/", "layout");
      return { ok: senha ? "Usuário e senha atualizados." : "Usuário atualizado.", t: Date.now() };
    }

    const nome = texto(fd, "nome");
    const email = texto(fd, "email")?.toLowerCase();
    if (!nome || !email) throw new ErroNegocio("Informe nome e e-mail.");
    if (!senha) throw new ErroNegocio("Informe uma senha inicial.");
    await db.insert(usuarios).values({ tenantId, nome, email, papel, senhaHash: await gerarHashSenha(senha) });
    revalidatePath("/", "layout");
    return { ok: `Usuário ${email} criado.`, t: Date.now() };
  });
}
