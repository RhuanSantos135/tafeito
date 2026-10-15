// Tema padrão "Tá Feito" — usado quando a mercearia não personalizou.
export const TEMA_PADRAO = {
  corPrimaria: "#16a34a",
  corSecundaria: "#f59e0b",
  fundoUrl: null as string | null,
  logoUrl: null as string | null,
};

export type Tema = typeof TEMA_PADRAO;

export function resolverTema(t?: Partial<Record<keyof Tema, string | null>> | null): Tema {
  return {
    corPrimaria: t?.corPrimaria || TEMA_PADRAO.corPrimaria,
    corSecundaria: t?.corSecundaria || TEMA_PADRAO.corSecundaria,
    fundoUrl: t?.fundoUrl || null,
    logoUrl: t?.logoUrl || null,
  };
}

export function estiloTema(tema: Tema): React.CSSProperties {
  return {
    ["--primaria" as string]: tema.corPrimaria,
    ["--secundaria" as string]: tema.corSecundaria,
  };
}
