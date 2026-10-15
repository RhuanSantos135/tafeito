CREATE TABLE `categorias` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`nome` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categorias_tenant_nome_uq` ON `categorias` (`tenant_id`,`nome`);--> statement-breakpoint
CREATE TABLE `clientes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`nome` text NOT NULL,
	`telefone` text,
	`cpf` text,
	`limite_credito_centavos` integer DEFAULT 0 NOT NULL,
	`dias_prazo` integer DEFAULT 30 NOT NULL,
	`ativo` integer DEFAULT true NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `clientes_tenant_idx` ON `clientes` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `configuracoes` (
	`chave` text PRIMARY KEY NOT NULL,
	`valor` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `contas_receber` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`venda_id` integer,
	`cliente_id` integer NOT NULL,
	`valor_centavos` integer NOT NULL,
	`valor_pago_centavos` integer DEFAULT 0 NOT NULL,
	`vencimento` text NOT NULL,
	`status` text DEFAULT 'ABERTA' NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`venda_id`) REFERENCES `vendas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `contas_tenant_cliente_idx` ON `contas_receber` (`tenant_id`,`cliente_id`);--> statement-breakpoint
CREATE INDEX `contas_tenant_venc_idx` ON `contas_receber` (`tenant_id`,`vencimento`);--> statement-breakpoint
CREATE TABLE `entradas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`fornecedor_id` integer,
	`nota_fiscal` text,
	`data` text NOT NULL,
	`total_centavos` integer DEFAULT 0 NOT NULL,
	`observacao` text,
	`usuario_id` integer,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`fornecedor_id`) REFERENCES `fornecedores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `faturas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`competencia` text NOT NULL,
	`armazenamento_bytes` integer NOT NULL,
	`valor_base_centavos` integer NOT NULL,
	`valor_armazenamento_centavos` integer NOT NULL,
	`total_centavos` integer NOT NULL,
	`vencimento` text NOT NULL,
	`status` text DEFAULT 'ABERTA' NOT NULL,
	`paga_em` text,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `faturas_tenant_competencia_uq` ON `faturas` (`tenant_id`,`competencia`);--> statement-breakpoint
CREATE TABLE `fornecedores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`nome` text NOT NULL,
	`documento` text,
	`telefone` text,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `lotes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`produto_id` integer NOT NULL,
	`entrada_id` integer,
	`codigo` text,
	`quantidade_inicial` real NOT NULL,
	`quantidade` real NOT NULL,
	`validade` text,
	`custo_unitario_centavos` integer NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`produto_id`) REFERENCES `produtos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`entrada_id`) REFERENCES `entradas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `lotes_tenant_produto_idx` ON `lotes` (`tenant_id`,`produto_id`);--> statement-breakpoint
CREATE INDEX `lotes_validade_idx` ON `lotes` (`tenant_id`,`validade`);--> statement-breakpoint
CREATE TABLE `movimentacoes_estoque` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`produto_id` integer NOT NULL,
	`lote_id` integer,
	`tipo` text NOT NULL,
	`quantidade` real NOT NULL,
	`motivo` text,
	`observacao` text,
	`entrada_id` integer,
	`venda_id` integer,
	`usuario_id` integer,
	`data` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`produto_id`) REFERENCES `produtos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lote_id`) REFERENCES `lotes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`entrada_id`) REFERENCES `entradas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `mov_tenant_produto_idx` ON `movimentacoes_estoque` (`tenant_id`,`produto_id`);--> statement-breakpoint
CREATE INDEX `mov_tenant_data_idx` ON `movimentacoes_estoque` (`tenant_id`,`data`);--> statement-breakpoint
CREATE TABLE `pagamentos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`conta_receber_id` integer NOT NULL,
	`valor_centavos` integer NOT NULL,
	`forma` text NOT NULL,
	`data` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`usuario_id` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`conta_receber_id`) REFERENCES `contas_receber`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `produtos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`nome` text NOT NULL,
	`codigo_barras` text,
	`categoria_id` integer,
	`unidade` text DEFAULT 'UN' NOT NULL,
	`preco_custo_centavos` integer DEFAULT 0 NOT NULL,
	`preco_venda_centavos` integer DEFAULT 0 NOT NULL,
	`estoque_minimo` real DEFAULT 0 NOT NULL,
	`ativo` integer DEFAULT true NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`categoria_id`) REFERENCES `categorias`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `produtos_tenant_idx` ON `produtos` (`tenant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `produtos_tenant_barras_uq` ON `produtos` (`tenant_id`,`codigo_barras`);--> statement-breakpoint
CREATE TABLE `sessoes` (
	`id` text PRIMARY KEY NOT NULL,
	`usuario_id` integer NOT NULL,
	`expira_em` text NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nome` text NOT NULL,
	`slug` text NOT NULL,
	`documento` text,
	`email` text,
	`telefone` text,
	`ativo` integer DEFAULT true NOT NULL,
	`cor_primaria` text,
	`cor_secundaria` text,
	`fundo_url` text,
	`logo_url` text,
	`valor_base_centavos` integer,
	`valor_por_mb_centavos` integer,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_slug_unique` ON `tenants` (`slug`);--> statement-breakpoint
CREATE TABLE `usuarios` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer,
	`nome` text NOT NULL,
	`email` text NOT NULL,
	`senha_hash` text NOT NULL,
	`papel` text NOT NULL,
	`ativo` integer DEFAULT true NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usuarios_email_uq` ON `usuarios` (`email`);--> statement-breakpoint
CREATE TABLE `venda_itens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`venda_id` integer NOT NULL,
	`produto_id` integer NOT NULL,
	`quantidade` real NOT NULL,
	`preco_unitario_centavos` integer NOT NULL,
	`custo_unitario_centavos` integer NOT NULL,
	`desconto_centavos` integer DEFAULT 0 NOT NULL,
	`total_centavos` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`venda_id`) REFERENCES `vendas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`produto_id`) REFERENCES `produtos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `venda_itens_venda_idx` ON `venda_itens` (`venda_id`);--> statement-breakpoint
CREATE INDEX `venda_itens_tenant_produto_idx` ON `venda_itens` (`tenant_id`,`produto_id`);--> statement-breakpoint
CREATE TABLE `vendas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`cliente_id` integer,
	`usuario_id` integer,
	`data` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`subtotal_centavos` integer NOT NULL,
	`desconto_centavos` integer DEFAULT 0 NOT NULL,
	`total_centavos` integer NOT NULL,
	`forma_pagamento` text NOT NULL,
	`valor_recebido_centavos` integer,
	`troco_centavos` integer,
	`status` text DEFAULT 'CONCLUIDA' NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `vendas_tenant_data_idx` ON `vendas` (`tenant_id`,`data`);