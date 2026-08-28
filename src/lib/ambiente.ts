/**
 * Lê um número da variável de ambiente, com padrão que resiste a vazio.
 *
 * `Number('')` é zero, e variável criada em branco no painel da Vercel chega
 * como string vazia — não como ausente. O `??` não protege disso: ele só
 * dispara para `undefined`, e `''` passa direto e vira zero.
 *
 * Este projeto já pagou essa conta uma vez: um `DB_POOL_MAX` em branco virou
 * pool de zero conexões, que espera para sempre. O sintoma é dos piores,
 * porque a configuração parece estar lá — o nome da variável aparece no
 * painel, só o valor é que não existe.
 *
 * Vazio, texto que não é número, infinito e valor não positivo caem no
 * padrão. Nenhum dos ajustes deste projeto tem zero como valor útil: zero é
 * pool que não conecta, prazo que expira antes de começar e janela que
 * descarta a conexão a cada consulta.
 */
export function numeroDoAmbiente(nome: string, padrao: number): number {
  const bruto = process.env[nome]
  if (bruto === undefined || bruto.trim() === '') return padrao

  const n = Number(bruto)
  return Number.isFinite(n) && n > 0 ? n : padrao
}
