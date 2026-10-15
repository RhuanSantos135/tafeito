// PBKDF2 via Web Crypto: funciona no Workers e no Node (sem dependência nativa).
// Formato: pbkdf2$<iteracoes>$<salt b64>$<hash b64>
const ITERACOES = 100_000; // limite máximo suportado pelo Workers

function b64(buf: ArrayBuffer | Uint8Array) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function deB64(s: string) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function derivar(senha: string, salt: Uint8Array<ArrayBuffer>, iteracoes: number) {
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iteracoes }, chave, 256);
}

export async function gerarHashSenha(senha: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivar(senha, salt, ITERACOES);
  return `pbkdf2$${ITERACOES}$${b64(salt)}$${b64(hash)}`;
}

export async function verificarSenha(senha: string, armazenado: string) {
  const [alg, it, saltB64, hashB64] = armazenado.split("$");
  if (alg !== "pbkdf2" || !it || !saltB64 || !hashB64) return false;
  const calculado = new Uint8Array(await derivar(senha, deB64(saltB64), Number(it)));
  const esperado = deB64(hashB64);
  if (calculado.length !== esperado.length) return false;
  let diff = 0;
  for (let i = 0; i < calculado.length; i++) diff |= calculado[i] ^ esperado[i];
  return diff === 0;
}
