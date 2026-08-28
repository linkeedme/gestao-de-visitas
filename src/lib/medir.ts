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

/**
 * Teto de tempo para uma etapa que não pode prender a página.
 *
 * O painel foi observado em produção segurando a função até o limite da
 * Vercel — trezentos segundos — sem devolver nada. Cinco minutos de tela
 * parada não são um carregamento lento, são uma tela quebrada, e ainda
 * ocupam a instância inteira enquanto duram.
 *
 * Estourado o prazo, a promessa é rejeitada e o `error.tsx` assume, com um
 * recado e um botão de tentar de novo. Perder a tela em oito segundos é pior
 * que carregá-la, e muito melhor que prendê-la em trezentos.
 *
 * Isto trata o sintoma de propósito: enquanto a causa não aparece nos
 * registros, ninguém deveria ficar olhando para uma tela morta.
 */
export function comTeto<T>(etapa: string, segundos: number, f: () => Promise<T>): Promise<T> {
  return Promise.race([
    f(),
    new Promise<never>((_, rejeitar) =>
      setTimeout(
        () => rejeitar(new Error(`[PERF] ${etapa} passou de ${segundos}s e foi abandonada`)),
        segundos * 1000
      )
    ),
  ])
}
