import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { EstadoAcao } from "@/components/formulario";
import { ErroNegocio } from "@/lib/servicos/estoque";

/** Executa a lógica de uma action convertendo erros em mensagens para o formulário. */
export async function tentar(fn: () => Promise<EstadoAcao | void>): Promise<EstadoAcao> {
  try {
    return (await fn()) ?? { ok: "Salvo com sucesso.", t: Date.now() };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof ErroNegocio) return { erro: e.message, t: Date.now() };
    const msg = e instanceof Error ? e.message : String(e);
    if (/UNIQUE constraint failed/i.test(msg)) return { erro: "Já existe um registro com esses dados (duplicado).", t: Date.now() };
    console.error(e);
    return { erro: "Não foi possível concluir a operação. Tente novamente.", t: Date.now() };
  }
}

export function texto(fd: FormData, campo: string) {
  const v = fd.get(campo);
  const s = typeof v === "string" ? v.trim() : "";
  return s || null;
}

export function inteiro(fd: FormData, campo: string) {
  const n = Number(fd.get(campo));
  return Number.isInteger(n) && n > 0 ? n : null;
}
