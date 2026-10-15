import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <main className="grid min-h-[60vh] place-items-center p-8 text-center">
      <div>
        <div className="text-5xl">🔍</div>
        <h1 className="mt-3 text-xl font-bold">Página não encontrada</h1>
        <Link href="/" className="btn-primario mt-4">Voltar ao início</Link>
      </div>
    </main>
  );
}
