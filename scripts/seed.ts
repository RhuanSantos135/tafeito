// Popula o D1 com o super admin e (opcionalmente) uma mercearia de demonstração.
//
//   node scripts/seed.ts                 -> banco local, com dados demo
//   node scripts/seed.ts --remote --sem-demo  -> banco da Cloudflare, só o super admin
//
// Credenciais do super admin: SUPERADMIN_EMAIL e SUPERADMIN_SENHA (lidas do .env.seed, fora do git)
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { gerarHashSenha } from "../lib/senha.ts";

const remoto = process.argv.includes("--remote");
const comDemo = !process.argv.includes("--sem-demo");
const emailAdmin = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
const senhaAdmin = process.env.SUPERADMIN_SENHA;

if (!emailAdmin || !senhaAdmin) {
  console.error("Defina SUPERADMIN_EMAIL e SUPERADMIN_SENHA no arquivo .env.seed (veja .env.seed.example).");
  process.exit(1);
}

const q = (v: unknown) => (v === null || v === undefined ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const linhas: string[] = [];
const ins = (tabela: string, dados: Record<string, unknown>) =>
  linhas.push(`INSERT INTO ${tabela} (${Object.keys(dados).join(", ")}) VALUES (${Object.values(dados).map(q).join(", ")});`);

const dia = (offset: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const momento = (offset: number, hora: number) => `${dia(offset)}T${String(hora).padStart(2, "0")}:15:00.000Z`;

linhas.push(`DELETE FROM sessoes;`);
// A plataforma tem um único super admin: remove qualquer outro antes de criar
linhas.push(`DELETE FROM sessoes WHERE usuario_id IN (SELECT id FROM usuarios WHERE papel = 'SUPERADMIN');`);
linhas.push(`DELETE FROM usuarios WHERE papel = 'SUPERADMIN' OR email = ${q(emailAdmin)};`);
ins("usuarios", { tenant_id: null, nome: "Administrador da Plataforma", email: emailAdmin, senha_hash: await gerarHashSenha(senhaAdmin), papel: "SUPERADMIN" });

if (comDemo) {
  // Limpa a demo anterior (tenant 1) para o seed ser idempotente
  for (const t of ["pagamentos_conta_pagar", "contas_pagar", "categorias_despesa", "pagamentos", "contas_receber", "movimentacoes_estoque", "venda_itens", "vendas", "lotes", "entradas", "produtos", "categorias", "fornecedores", "clientes", "faturas"]) {
    linhas.push(`DELETE FROM ${t} WHERE tenant_id = 1;`);
  }
  linhas.push(`DELETE FROM usuarios WHERE tenant_id = 1;`);
  linhas.push(`DELETE FROM tenants WHERE id = 1;`);

  ins("tenants", { id: 1, nome: "Mercearia do Zé", slug: "mercearia-do-ze", email: "ze@demo.com", telefone: "(11) 99999-0000" });
  ins("usuarios", { tenant_id: 1, nome: "Zé (dono)", email: "ze@demo.com", senha_hash: await gerarHashSenha("demo123"), papel: "ADMIN" });
  ins("usuarios", { tenant_id: 1, nome: "Maria (caixa)", email: "caixa@demo.com", senha_hash: await gerarHashSenha("demo123"), papel: "OPERADOR" });

  const cats = ["Mercearia", "Bebidas", "Laticínios", "Hortifruti", "Limpeza", "Padaria"];
  cats.forEach((nome, i) => ins("categorias", { id: 100 + i, tenant_id: 1, nome }));

  // [nome, código de barras, categoria, unidade, custo, venda, mínimo, dias até vencer (null = não perecível)]
  const prods: [string, string, number, string, number, number, number, number | null][] = [
    ["Arroz Tipo 1 5kg", "7896006716112", 100, "UN", 2290, 2899, 10, 240],
    ["Feijão Carioca 1kg", "7896006744115", 100, "UN", 699, 899, 15, 180],
    ["Açúcar Refinado 1kg", "7891910000197", 100, "UN", 399, 549, 10, 365],
    ["Óleo de Soja 900ml", "7891107101621", 100, "UN", 599, 799, 12, 300],
    ["Café Torrado 500g", "7891910007110", 100, "UN", 1490, 1899, 8, 120],
    ["Macarrão Espaguete 500g", "7896022204013", 100, "UN", 399, 549, 10, 365],
    ["Refrigerante Cola 2L", "7894900011517", 101, "UN", 699, 999, 12, 90],
    ["Água Mineral 1,5L", "7896045500536", 101, "UN", 189, 349, 24, 365],
    ["Cerveja Lata 350ml", "7891149100101", 101, "UN", 299, 449, 24, 150],
    ["Leite Integral 1L", "7896259410133", 102, "UN", 449, 599, 24, 5],
    ["Queijo Mussarela", "2000000000011", 102, "KG", 3290, 4490, 2, 12],
    ["Iogurte Morango 170g", "7891025100355", 102, "UN", 199, 329, 10, 3],
    ["Banana Prata", "2000000000028", 103, "KG", 390, 699, 5, 6],
    ["Tomate", "2000000000035", 103, "KG", 590, 899, 4, 4],
    ["Detergente 500ml", "7891022100013", 104, "UN", 189, 299, 12, null],
    ["Sabão em Pó 1kg", "7891024134702", 104, "UN", 1090, 1499, 6, null],
    ["Pão Francês", "2000000000042", 105, "KG", 890, 1690, 3, 1],
    ["Biscoito Recheado 130g", "7891000100103", 100, "UN", 199, 349, 15, 200],
    ["Fermento em Pó 100g", "7891000000001", 100, "UN", 299, 499, 3, 400],
  ];

  ins("fornecedores", { id: 100, tenant_id: 1, nome: "Atacadão Distribuidora", documento: "12.345.678/0001-90", telefone: "(11) 3333-4444" });
  ins("fornecedores", { id: 101, tenant_id: 1, nome: "Laticínios Boa Vista", documento: "98.765.432/0001-10", telefone: "(11) 2222-1111" });
  ins("entradas", { id: 100, tenant_id: 1, fornecedor_id: 100, nota_fiscal: "000123", data: dia(-20), total_centavos: 0, usuario_id: null });

  type Lote = { id: number; produto: number; qtd: number; custo: number };
  const lotes: Lote[] = [];
  let totalEntrada = 0;
  prods.forEach(([nome, barras, cat, un, custo, venda, minimo, venc], i) => {
    const pid = 100 + i;
    ins("produtos", { id: pid, tenant_id: 1, nome, codigo_barras: barras, categoria_id: cat, unidade: un, preco_custo_centavos: custo, preco_venda_centavos: venda, estoque_minimo: minimo });
    const qtd = un === "KG" ? 20 : 48;
    const lid = 100 + i;
    ins("lotes", { id: lid, tenant_id: 1, produto_id: pid, entrada_id: 100, codigo: `L${2400 + i}`, quantidade_inicial: qtd, quantidade: qtd, validade: venc === null ? null : dia(venc), custo_unitario_centavos: custo });
    ins("movimentacoes_estoque", { tenant_id: 1, produto_id: pid, lote_id: lid, tipo: "ENTRADA", quantidade: qtd, entrada_id: 100, data: momento(-20, 12) });
    lotes.push({ id: lid, produto: pid, qtd, custo });
    totalEntrada += qtd * custo;
  });
  linhas.push(`UPDATE entradas SET total_centavos = ${totalEntrada} WHERE id = 100;`);

  const clientes = [
    ["Dona Cida", "(11) 98888-1111", "123.456.789-00", 50000, 30],
    ["Seu João da Padaria", "(11) 97777-2222", "987.654.321-00", 30000, 15],
    ["Ana Paula", "(11) 96666-3333", null, 20000, 30],
  ] as const;
  clientes.forEach(([nome, tel, cpf, limite, prazo], i) =>
    ins("clientes", { id: 100 + i, tenant_id: 1, nome, telefone: tel, cpf, limite_credito_centavos: limite, dias_prazo: prazo }),
  );

  // Vendas dos últimos 25 dias (pseudo-aleatórias e determinísticas). Produtos 117/118 ficam "parados".
  let semente = 42;
  const rnd = () => ((semente = (semente * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const formas = ["DINHEIRO", "PIX", "PIX", "DEBITO", "CREDITO"];
  let vendaId = 1000;
  for (let d = -25; d <= 0; d++) {
    const nVendas = 2 + Math.floor(rnd() * 5);
    for (let k = 0; k < nVendas; k++) {
      vendaId++;
      const itens: { pid: number; qtd: number; preco: number; custo: number; lote: Lote }[] = [];
      const nItens = 1 + Math.floor(rnd() * 4);
      for (let j = 0; j < nItens; j++) {
        const idx = Math.floor(rnd() * 17);
        const lote = lotes[idx];
        const [, , , un, , preco] = prods[idx];
        const qtd = un === "KG" ? Math.round((0.3 + rnd() * 1.2) * 1000) / 1000 : 1 + Math.floor(rnd() * 3);
        if (lote.qtd < qtd || itens.some((it) => it.pid === lote.produto)) continue;
        lote.qtd = Math.round((lote.qtd - qtd) * 1000) / 1000;
        itens.push({ pid: lote.produto, qtd, preco, custo: lote.custo, lote });
      }
      if (!itens.length) continue;
      const total = itens.reduce((s, it) => s + Math.round(it.preco * it.qtd), 0);
      const fiado = k === 0 && d % 6 === 0;
      const forma = fiado ? "PRAZO" : formas[Math.floor(rnd() * formas.length)];
      const cliente = fiado ? 100 + ((Math.abs(d) / 6) % 3) : null;
      const quando = momento(d, 11 + k * 2);
      ins("vendas", { id: vendaId, tenant_id: 1, cliente_id: cliente, data: quando, subtotal_centavos: total, desconto_centavos: 0, total_centavos: total, forma_pagamento: forma, valor_recebido_centavos: forma === "DINHEIRO" ? total : null, troco_centavos: forma === "DINHEIRO" ? 0 : null });
      for (const it of itens) {
        ins("venda_itens", { tenant_id: 1, venda_id: vendaId, produto_id: it.pid, quantidade: it.qtd, preco_unitario_centavos: it.preco, custo_unitario_centavos: it.custo, desconto_centavos: 0, total_centavos: Math.round(it.preco * it.qtd) });
        ins("movimentacoes_estoque", { tenant_id: 1, produto_id: it.pid, lote_id: it.lote.id, tipo: "VENDA", quantidade: -it.qtd, venda_id: vendaId, data: quando });
      }
      if (fiado && cliente) {
        const prazo = clientes[cliente - 100][4];
        ins("contas_receber", { tenant_id: 1, venda_id: vendaId, cliente_id: cliente, valor_centavos: total, valor_pago_centavos: 0, vencimento: dia(d + prazo), status: "ABERTA" });
      }
    }
  }
  for (const l of lotes) linhas.push(`UPDATE lotes SET quantidade = ${l.qtd} WHERE id = ${l.id};`);

  // Contas a pagar: categorias padrão + despesas fixas do mês passado (pagas), deste mês e do próximo
  const catsDespesa = ["Fornecedor", "Energia (luz)", "Água", "Funcionários", "Aluguel", "Internet e telefone", "Impostos e taxas", "Manutenção", "Outros"];
  catsDespesa.forEach((nome, i) => ins("categorias_despesa", { id: 100 + i, tenant_id: 1, nome }));
  const mesStr = (offset: number, diaMes: number) => {
    const d = new Date();
    const alvo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, diaMes));
    return alvo.toISOString().slice(0, 10);
  };
  let contaId = 100;
  const conta = (dados: Record<string, unknown>, pagaEm?: string, forma = "PIX") => {
    contaId++;
    ins("contas_pagar", { id: contaId, tenant_id: 1, status: pagaEm ? "PAGA" : "ABERTA", valor_pago_centavos: pagaEm ? dados.valor_centavos : 0, ...dados });
    if (pagaEm) ins("pagamentos_conta_pagar", { tenant_id: 1, conta_pagar_id: contaId, valor_centavos: dados.valor_centavos, forma, data: pagaEm });
  };
  const fixas: [string, number, number, number][] = [
    // [descrição, categoria, valor, dia do vencimento]
    ["Aluguel do ponto", 104, 180000, 5],
    ["Conta de luz", 101, 48730, 12],
    ["Conta de água", 102, 12650, 18],
    ["Internet", 105, 9990, 20],
    ["Salário — Maria (caixa)", 103, 165000, 5],
  ];
  for (const [i, [descricao, cat, valor, diaMes]] of fixas.entries()) {
    const grupo = `demo-fixa-${i}`;
    for (const m of [-1, 0, 1]) {
      const venc = mesStr(m, diaMes);
      const paga = m < 0 || (m === 0 && venc < dia(-3));
      conta({ descricao, categoria_id: cat, valor_centavos: valor, vencimento: venc, grupo, parcela: m + 2, total_parcelas: 3 }, paga ? venc : undefined, cat === 103 ? "TRANSFERENCIA" : "PIX");
    }
  }
  // Boleto da compra (entrada 100) em 2x — a primeira já venceu e não foi paga, para aparecer como atrasada
  const metade = Math.floor(totalEntrada / 2);
  conta({ descricao: "Compra NF 000123", categoria_id: 100, fornecedor_id: 100, entrada_id: 100, documento: "000123", valor_centavos: totalEntrada - metade, vencimento: dia(-2), grupo: "demo-nf123", parcela: 1, total_parcelas: 2 });
  conta({ descricao: "Compra NF 000123", categoria_id: 100, fornecedor_id: 100, entrada_id: 100, documento: "000123", valor_centavos: metade, vencimento: dia(28), grupo: "demo-nf123", parcela: 2, total_parcelas: 2 });
  conta({ descricao: "Conserto da geladeira", categoria_id: 107, valor_centavos: 35000, vencimento: dia(-10) }, dia(-10), "DINHEIRO");

  // Uma perda registrada, para ilustrar as saídas
  linhas.push(`UPDATE lotes SET quantidade = round(quantidade - 2, 3) WHERE id = 109;`);
  ins("movimentacoes_estoque", { tenant_id: 1, produto_id: 109, lote_id: 109, tipo: "SAIDA", quantidade: -2, motivo: "QUEBRA", observacao: "Caixa caiu no descarregamento", data: momento(-3, 14) });
}

writeFileSync("db/seed.sql", linhas.join("\n") + "\n");
console.log(`db/seed.sql gerado (${linhas.length} comandos). Aplicando no banco ${remoto ? "REMOTO" : "local"}...`);
execFileSync("npx", ["wrangler", "d1", "execute", "tafeito-db", remoto ? "--remote" : "--local", "--file=./db/seed.sql"], { stdio: "inherit" });
console.log(`\nSuper admin: ${emailAdmin} (senha definida no .env.seed)`);
if (comDemo) console.log("Mercearia demo: ze@demo.com / demo123 (admin)  ·  caixa@demo.com / demo123 (operador)");
