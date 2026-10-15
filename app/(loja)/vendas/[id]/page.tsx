import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Enviar, Formulario } from "@/components/formulario";
import { Selo } from "@/components/ui";
import { clientes, contasReceber, produtos, tenants, usuarios, vendaItens, vendas } from "@/db/schema";
import { exigirTenant } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { dataBR, qtd, reais, ROTULO_PAGAMENTO } from "@/lib/formato";
import { BotaoImprimir } from "./botao-imprimir";
import { cancelar } from "../actions";

export default async function VerVenda({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigirTenant();
  const id = Number((await params).id);
  const db = await getDb();
  const [v] = await db
    .select({ v: vendas, cliente: clientes.nome, operador: usuarios.nome, loja: tenants.nome, doc: tenants.documento })
    .from(vendas)
    .innerJoin(tenants, eq(tenants.id, vendas.tenantId))
    .leftJoin(clientes, eq(clientes.id, vendas.clienteId))
    .leftJoin(usuarios, eq(usuarios.id, vendas.usuarioId))
    .where(and(eq(vendas.id, id), eq(vendas.tenantId, u.tenantId)));
  if (!v) notFound();
  const [itens, [conta]] = await Promise.all([
    db.select({ i: vendaItens, nome: produtos.nome, unidade: produtos.unidade }).from(vendaItens).innerJoin(produtos, eq(produtos.id, vendaItens.produtoId)).where(eq(vendaItens.vendaId, id)),
    db.select().from(contasReceber).where(eq(contasReceber.vendaId, id)),
  ]);
  const custo = itens.reduce((s, { i }) => s + i.custoUnitarioCentavos * i.quantidade, 0);

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        <Link href="/vendas" className="btn-secundario">Voltar</Link>
        <Link href="/pdv" className="btn-secundario">Ir para o PDV</Link>
        <BotaoImprimir />
      </div>
      <div className="cartao p-6 font-mono text-sm print:border-0 print:shadow-none">
        <div className="text-center">
          <div className="text-base font-bold">{v.loja}</div>
          {v.doc && <div>{v.doc}</div>}
          <div className="mt-2 text-xs">COMPROVANTE DE VENDA Nº {v.v.id}</div>
          <div className="text-xs">NÃO É DOCUMENTO FISCAL</div>
          <div className="text-xs">{dataBR(v.v.data)}</div>
        </div>
        {v.v.status === "CANCELADA" && <div className="my-3 text-center"><Selo tom="vermelho">VENDA CANCELADA</Selo></div>}
        <div className="my-3 border-t border-dashed border-stone-300" />
        {itens.map(({ i, nome, unidade }) => (
          <div key={i.id} className="mb-1">
            <div>{nome}</div>
            <div className="flex justify-between text-stone-600">
              <span>{qtd(i.quantidade, unidade)} x {reais(i.precoUnitarioCentavos)}{i.descontoCentavos ? ` (-${reais(i.descontoCentavos)})` : ""}</span>
              <span>{reais(i.totalCentavos)}</span>
            </div>
          </div>
        ))}
        <div className="my-3 border-t border-dashed border-stone-300" />
        <div className="flex justify-between"><span>Subtotal</span><span>{reais(v.v.subtotalCentavos)}</span></div>
        {v.v.descontoCentavos > 0 && <div className="flex justify-between"><span>Desconto</span><span>-{reais(v.v.descontoCentavos)}</span></div>}
        <div className="flex justify-between text-base font-bold"><span>TOTAL</span><span>{reais(v.v.totalCentavos)}</span></div>
        <div className="mt-2 flex justify-between"><span>Pagamento</span><span>{ROTULO_PAGAMENTO[v.v.formaPagamento]}</span></div>
        {v.v.valorRecebidoCentavos != null && <div className="flex justify-between"><span>Recebido</span><span>{reais(v.v.valorRecebidoCentavos)}</span></div>}
        {v.v.trocoCentavos ? <div className="flex justify-between"><span>Troco</span><span>{reais(v.v.trocoCentavos)}</span></div> : null}
        {v.cliente && <div className="mt-2">Cliente: {v.cliente}</div>}
        {conta && <div>Vencimento: {dataBR(conta.vencimento)}</div>}
        {v.operador && <div className="text-xs text-stone-500">Operador: {v.operador}</div>}
        {conta && (
          <div className="mt-8 text-center text-xs">
            ____________________________________
            <br />
            Assinatura do cliente
          </div>
        )}
      </div>
      {u.papel === "ADMIN" && (
        <div className="mt-4 rounded-lg bg-white/70 p-3 text-sm text-stone-500 print:hidden">
          Margem desta venda: <b>{reais(Math.round(v.v.totalCentavos - custo))}</b>
          {v.v.status === "CONCLUIDA" && (
            <Formulario acao={cancelar} confirmar="Cancelar esta venda? O estoque será devolvido." className="mt-3">
              <input type="hidden" name="id" value={v.v.id} />
              <Enviar className="btn-perigo btn-sm">Cancelar venda</Enviar>
            </Formulario>
          )}
        </div>
      )}
    </div>
  );
}
