import { salvarUsuario } from "@/app/acoes-compartilhadas";
import { Enviar, Formulario } from "@/components/formulario";
import { Selo } from "@/components/ui";

type U = { id: number; nome: string; email: string; papel: string; ativo: boolean };

export function GestaoUsuarios({ tenantId, usuarios }: { tenantId: number; usuarios: U[] }) {
  return (
    <div className="space-y-4">
      <ul className="divide-y divide-stone-100">
        {usuarios.map((u) => (
          <li key={u.id} className="py-3">
            <details>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                <span>
                  <span className="font-medium">{u.nome}</span> <span className="text-sm text-stone-400">{u.email}</span>
                </span>
                <span className="flex gap-1">
                  <Selo tom={u.papel === "ADMIN" ? "azul" : "cinza"}>{u.papel === "ADMIN" ? "Admin" : "Operador"}</Selo>
                  {!u.ativo && <Selo tom="vermelho">inativo</Selo>}
                </span>
              </summary>
              <Formulario acao={salvarUsuario} className="mt-3 grid gap-2 rounded-lg bg-stone-50 p-3 sm:grid-cols-2">
                <input type="hidden" name="tenantId" value={tenantId} />
                <input type="hidden" name="id" value={u.id} />
                <input name="nome" defaultValue={u.nome} className="campo" />
                <select name="papel" defaultValue={u.papel} className="campo">
                  <option value="OPERADOR">Operador de caixa</option>
                  <option value="ADMIN">Administrador</option>
                </select>
                <select name="ativo" defaultValue={u.ativo ? "1" : "0"} className="campo">
                  <option value="1">Ativo</option>
                  <option value="0">Inativo</option>
                </select>
                <input name="senha" type="password" placeholder="Nova senha (opcional)" className="campo" autoComplete="new-password" />
                <div className="sm:col-span-2"><Enviar className="btn-secundario btn-sm">Salvar usuário</Enviar></div>
              </Formulario>
            </details>
          </li>
        ))}
      </ul>
      <Formulario acao={salvarUsuario} limparAoSalvar className="grid gap-2 border-t border-stone-100 pt-4 sm:grid-cols-2">
        <input type="hidden" name="tenantId" value={tenantId} />
        <div className="text-sm font-semibold sm:col-span-2">Novo usuário</div>
        <input name="nome" placeholder="Nome" className="campo" required />
        <input name="email" type="email" placeholder="E-mail (login)" className="campo" required />
        <input name="senha" type="password" placeholder="Senha inicial" className="campo" required autoComplete="new-password" />
        <select name="papel" className="campo">
          <option value="OPERADOR">Operador de caixa</option>
          <option value="ADMIN">Administrador</option>
        </select>
        <div className="sm:col-span-2"><Enviar>Criar usuário</Enviar></div>
      </Formulario>
    </div>
  );
}
