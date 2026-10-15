import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecalho, Cartao, Selo, TabelaRolavel } from "@/components/ui";
import { contasPagar, entradas, fornecedores, lotes, produtos, usuarios } from "@/db/schema";
import { exigirTenant } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { dataBR, qtd, reais } from "@/lib/formato";

export default async function VerEntrada({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const u = await exigirTenant();
  const id = Number((await params).id);
  const { ok } = await searchParams;
  const db = await getDb();
  const [e] = await db
    .select({ e: entradas, fornecedor: fornecedores.nome, usuario: usuarios.nome })
    .from(entradas)
    .leftJoin(fornecedores, eq(fornecedores.id, entradas.fornecedorId))
    .leftJoin(usuarios, eq(usuarios.id, entradas.usuarioId))
    .where(and(eq(entradas.id, id), eq(entradas.tenantId, u.tenantId)));
  if (!e) notFound();
  const itens = await db
    .select({ l: lotes, nome: produtos.nome, unidade: produtos.unidade })
    .from(lotes)
    .innerJoin(produtos, eq(produtos.id, lotes.produtoId))
    .where(eq(lotes.entradaId, id));
  const contas = await db.select().from(contasPagar).where(and(eq(contasPagar.entradaId, id), eq(contasPagar.tenantId, u.tenantId)));

  return (
    <>
      <Cabecalho
        titulo={`Entrada #${id}`}
        descricao={`${dataBR(e.e.data)} · ${e.fornecedor ?? "Sem fornecedor"}${e.e.notaFiscal ? ` · NF ${e.e.notaFiscal}` : ""}${e.usuario ? ` · por ${e.usuario}` : ""}`}
        acoes={
          <>
            <Link href="/entradas" className="btn-secundario">Voltar</Link>
            <Link href="/entradas/nova" className="btn-primario">+ Nova entrada</Link>
          </>
        }
      />
      {ok && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Entrada registrada e estoque atualizado.</p>}
      <Cartao titulo={`Total ${reais(e.e.totalCentavos)}`}>
        <TabelaRolavel>
          <table className="tabela">
            <thead>
              <tr><th>Produto</th><th>Lote</th><th>Validade</th><th className="text-right">Quantidade</th><th className="text-right">Saldo atual</th><th className="text-right">Custo unit.</th><th className="text-right">Subtotal</th></tr>
            </thead>
            <tbody>
              {itens.map(({ l, nome, unidade }) => (
                <tr key={l.id}>
                  <td className="font-medium">{nome}</td>
                  <td>{l.codigo ?? `#${l.id}`}</td>
                  <td>{dataBR(l.validade)}</td>
                  <td className="text-right tabular-nums">{qtd(l.quantidadeInicial, unidade)}</td>
                  <td className="text-right tabular-nums">{qtd(l.quantidade, unidade)}</td>
                  <td className="text-right tabular-nums">{reais(l.custoUnitarioCentavos)}</td>
                  <td className="text-right tabular-nums">{reais(Math.round(l.quantidadeInicial * l.custoUnitarioCentavos))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabelaRolavel>
        {e.e.observacao && <p className="mt-6 text-sm text-stone-500">Obs.: {e.e.observacao}</p>}
      </Cartao>
      {contas.length > 0 && (
        <Cartao titulo="Contas a pagar desta compra" className="mt-6" acoes={<Link href="/contas-pagar" className="link text-sm">Ver contas a pagar</Link>}>
          <ul className="divide-y divide-stone-100 text-sm">
            {contas.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2">
                <span>{c.totalParcelas ? `Parcela ${c.parcela}/${c.totalParcelas}` : "Parcela única"} · vence {dataBR(c.vencimento)}</span>
                <span className="flex items-center gap-2">
                  <b className="tabular-nums">{reais(c.valorCentavos)}</b>
                  <Selo tom={c.status === "PAGA" ? "verde" : c.status === "CANCELADA" ? "cinza" : "amarelo"}>{c.status.toLowerCase()}</Selo>
                </span>
              </li>
            ))}
          </ul>
        </Cartao>
      )}
    </>
  );
}
