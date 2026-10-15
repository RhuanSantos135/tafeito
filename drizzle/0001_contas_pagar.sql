CREATE TABLE `categorias_despesa` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`nome` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categorias_despesa_tenant_nome_uq` ON `categorias_despesa` (`tenant_id`,`nome`);--> statement-breakpoint
CREATE TABLE `contas_pagar` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`descricao` text NOT NULL,
	`categoria_id` integer,
	`fornecedor_id` integer,
	`entrada_id` integer,
	`documento` text,
	`valor_centavos` integer NOT NULL,
	`valor_pago_centavos` integer DEFAULT 0 NOT NULL,
	`vencimento` text NOT NULL,
	`grupo` text,
	`parcela` integer,
	`total_parcelas` integer,
	`status` text DEFAULT 'ABERTA' NOT NULL,
	`observacao` text,
	`usuario_id` integer,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`categoria_id`) REFERENCES `categorias_despesa`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`fornecedor_id`) REFERENCES `fornecedores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`entrada_id`) REFERENCES `entradas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `contas_pagar_tenant_venc_idx` ON `contas_pagar` (`tenant_id`,`vencimento`);--> statement-breakpoint
CREATE INDEX `contas_pagar_tenant_cat_idx` ON `contas_pagar` (`tenant_id`,`categoria_id`);--> statement-breakpoint
CREATE TABLE `pagamentos_conta_pagar` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`conta_pagar_id` integer NOT NULL,
	`valor_centavos` integer NOT NULL,
	`forma` text NOT NULL,
	`data` text NOT NULL,
	`usuario_id` integer,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`conta_pagar_id`) REFERENCES `contas_pagar`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
