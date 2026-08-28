/**
 * Cronômetro de diagnóstico para o servidor.
 *
 * Existe porque nenhuma medição feita da máquina de quem desenvolve encontrou
 * a lentidão que a pessoa sente ao usar o sistema: daqui o banco responde em
 * quarenta milésimos, e as telas exigem sessão, então não dá para cronometrar
 * de fora com `curl`. O que sobra é medir de dentro e ler nos registros.
 *
 * Sai como uma linha por etapa, com o prefixo [PERF], para dar para filtrar
 * nos registros da Vercel.
 */
export async function medir<T>(etapa: string, f: () => Promise<T>): Promise<T> {
  const t = Date.now()
  try {
    return await f()
  } finally {
    console.log(`[PERF] ${etapa}: ${Date.now() - t}ms`)
  }
}
