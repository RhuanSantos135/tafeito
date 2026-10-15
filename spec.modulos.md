Módulos essenciais

1. Produtos
Cadastro com nome, código de barras, categoria, unidade (un, kg, cx), preço de custo, preço de venda, estoque mínimo e data de validade (por lote, isso é importante em mercearia).

2. Entrada (compras/reposição)
Registra o que chega do fornecedor: fornecedor, nota fiscal, produtos, quantidade, custo unitário, lote e validade. Cada entrada soma no estoque.

3. Saída
Tudo que tira do estoque e não é venda: perda, quebra, vencido, consumo próprio, ajuste de inventário. Sempre com motivo, senão o estoque nunca fecha.

4. Venda (PDV)
Tela rápida: bipa ou busca o produto, quantidade, desconto, forma de pagamento (dinheiro, Pix, cartão, a prazo). Cada venda baixa o estoque automaticamente.

5. Clientes e fiado (a prazo)
Cadastro do cliente com limite de crédito. Venda a prazo gera uma conta a receber com vencimento. Precisa de: saldo devedor por cliente, pagamento parcial, histórico, e bloqueio quando passa do limite ou tem conta vencida.

6. Vencimentos (dois tipos)

Contas a receber: fiado vencendo/vencido.
Validade de produto: lotes vencendo nos próximos 7/15/30 dias, pra fazer promoção antes de virar perda.

7. Dashboard

Faturamento do dia/semana/mês e ticket médio
Top produtos mais vendidos (por quantidade e por faturamento, são rankings diferentes)
Margem por produto (venda − custo)
Produtos abaixo do estoque mínimo
Produtos parados (sem venda há X dias)
Total em fiado a receber e quanto está vencido
Lotes perto do vencimento
Modelo de dados básico
produto (id, nome, codigo_barras, categoria, unidade, preco_custo, preco_venda, estoque_minimo)
lote (id, produto_id, quantidade, validade, custo_unitario)
movimentacao_estoque (id, produto_id, lote_id, tipo[ENTRADA|SAIDA|VENDA], quantidade, motivo, data)
cliente (id, nome, telefone, cpf, limite_credito)
venda (id, cliente_id, data, total, desconto, forma_pagamento)
venda_item (id, venda_id, produto_id, quantidade, preco_unitario, custo_unitario)
conta_receber (id, venda_id, cliente_id, valor, vencimento, status[ABERTA|PAGA|VENCIDA])
pagamento (id, conta_receber_id, valor, data, forma)

O porquê de dois detalhes: guardar custo_unitario no venda_item congela a margem no momento da venda (se o custo mudar depois, o histórico não quebra). E ter uma tabela única movimentacao_estoque faz o estoque ser auditável: o saldo é sempre a soma das movimentações.

Passo a passo pra construir
Cadastro de produtos e categorias — base de tudo.
Entrada de estoque com lote/validade — já dá pra ter saldo real.
Venda à vista (PDV simples) — baixa estoque automaticamente.
Saídas/ajustes — fecha o controle de estoque.
Clientes + venda a prazo + contas a receber — com limite e baixa de pagamento.
Alertas — estoque mínimo, fiado vencido, lote vencendo.
Dashboard — por último, porque depende dos dados das etapas anteriores.