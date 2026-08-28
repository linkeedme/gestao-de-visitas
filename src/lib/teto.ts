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
      // Só rejeita. Descartar o pool aqui seria mais um caminho capaz de
      // destruir conexão que outra requisição está usando — e o fechamento
      // ao fim de cada requisição já garante que a próxima nasça limpa.
      setTimeout(
        () => rejeitar(new Error(`${etapa} passou de ${segundos}s e foi abandonada`)),
        segundos * 1000
      )
    ),
  ])
}
