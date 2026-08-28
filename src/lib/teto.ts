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
  let temporizador: ReturnType<typeof setTimeout> | undefined

  return Promise.race([
    f(),
    new Promise<never>((_, rejeitar) => {
      // Só rejeita. Descartar o pool aqui seria mais um caminho capaz de
      // destruir conexão que outra requisição está usando.
      temporizador = setTimeout(
        () => rejeitar(new Error(`${etapa} passou de ${segundos}s e foi abandonada`)),
        segundos * 1000
      )
    }),
    // O temporizador precisa ser cancelado quando a corrida termina antes
    // dele. Sem isto, cada requisição deixava um timer vivo por até oito
    // segundos depois de já ter respondido — e no serverless a instância só
    // é liberada quando o laço de eventos esvazia.
  ]).finally(() => clearTimeout(temporizador))
}

/**
 * Espera uma promessa até um prazo, sem cancelá-la nem deixá-la explodir.
 *
 * Devolve `true` quando ela terminou dentro do prazo e `false` quando o prazo
 * venceu primeiro — a promessa continua correndo, e cabe a quem chamou
 * decidir o que fazer com ela.
 *
 * É o que permite esperar pelo espelho no CRM só enquanto isso for barato:
 * respondeu rápido, a tela já mostra a visita sincronizada; demorou, a pessoa
 * é liberada e o envio termina depois da resposta.
 */
export function esperarAte(promessa: Promise<unknown>, ms: number): Promise<boolean> {
  let temporizador: ReturnType<typeof setTimeout> | undefined

  return Promise.race([
    // Terminar com erro ainda é terminar: o interesse aqui é o relógio, não o
    // desfecho. Sem os dois lados, uma rejeição viraria rejeição desta função.
    promessa.then(
      () => true,
      () => true
    ),
    new Promise<boolean>((resolver) => {
      temporizador = setTimeout(() => resolver(false), ms)
    }),
  ]).finally(() => clearTimeout(temporizador))
}
