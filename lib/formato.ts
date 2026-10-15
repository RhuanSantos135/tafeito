// Utilitários de formatação e datas (fuso de Brasília).
export const FUSO = "America/Sao_Paulo";

export function reais(centavos: number | null | undefined) {
  return ((centavos ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Converte "12,50" / "12.50" / "1.234,56" em centavos. */
export function paraCentavos(valor: FormDataEntryValue | string | null | undefined) {
  if (valor == null) return 0;
  let s = String(valor).trim().replace(/[R$\s]/g, "");
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function paraNumero(valor: FormDataEntryValue | string | null | undefined) {
  if (valor == null) return 0;
  const s = String(valor).trim().replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export function centavosParaInput(centavos: number | null | undefined) {
  return ((centavos ?? 0) / 100).toFixed(2).replace(".", ",");
}

export function qtd(n: number, unidade?: string) {
  const casas = unidade === "KG" || unidade === "LT" ? 3 : 0;
  const v = Number.isInteger(n) ? n.toString() : n.toLocaleString("pt-BR", { maximumFractionDigits: casas || 3 });
  return unidade ? `${v} ${unidade.toLowerCase()}` : v;
}

/** Data de hoje (YYYY-MM-DD) no fuso de Brasília. */
export function hoje() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(new Date());
}

export function somarDias(data: string, dias: number) {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function diasEntre(de: string, ate: string) {
  return Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);
}

export function dataBR(data: string | null | undefined) {
  if (!data) return "—";
  if (data.length === 10) {
    const [a, m, d] = data.split("-");
    return `${d}/${m}/${a}`;
  }
  return new Date(data).toLocaleString("pt-BR", { timeZone: FUSO, dateStyle: "short", timeStyle: "short" });
}

export function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(2)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const ROTULO_PAGAMENTO: Record<string, string> = {
  DINHEIRO: "Dinheiro",
  PIX: "Pix",
  DEBITO: "Cartão débito",
  CREDITO: "Cartão crédito",
  PRAZO: "A prazo (fiado)",
};

export const ROTULO_MOTIVO: Record<string, string> = {
  PERDA: "Perda",
  QUEBRA: "Quebra",
  VENCIDO: "Vencido",
  CONSUMO_PROPRIO: "Consumo próprio",
  AJUSTE_INVENTARIO: "Ajuste de inventário",
};

export function dias(n: number) {
  return `${n} ${n === 1 ? "dia" : "dias"}`;
}

/** Soma meses mantendo o dia (limitado ao último dia do mês: 31/01 + 1 = 28/02). */
export function somarMeses(data: string, meses: number) {
  const [a, m, d] = data.split("-").map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return alvo.toISOString().slice(0, 10);
}

export const ROTULO_FORMA_PAGAR: Record<string, string> = {
  DINHEIRO: "Dinheiro",
  PIX: "Pix",
  BOLETO: "Boleto",
  TRANSFERENCIA: "Transferência",
  DEBITO: "Cartão débito",
  CREDITO: "Cartão crédito",
};
