/**
 * Teto de tempo para uma etapa que não pode prender a página.
 *
 * O painel foi observado em produção segurando a função até o limite da
 * Vercel — trezentos segundos — sem devolver nada. Cinco minutos de tela
 * parada não são um carregamento lento, são uma tela quebrada, e ainda
 * ocupam a instância inteira enquanto duram.
 *
 * Estourado o prazo, a promessa é rejeitada e o `error.tsx` assume, com um
 * recado e um botão de tentar de novo. Perder a tela em doze segundos é pior
 * que carregá-la, e muito melhor que prendê-la em trezentos.
 *
 * Este teto é a última linha, não a primeira: os prazos de conexão e de
 * consulta são menores de propósito, para que cada causa dispare com o próprio
 * nome antes de o teto genérico assumir.
 */
export function comTeto<T>(etapa: string, segundos: number, f: () => Promise<T>): Promise<T> {
  let temporizador: ReturnType<typeof setTimeout> | undefined
  let abandonada = false

  const trabalho = f()

  /**
   * O erro que chega atrasado precisa aparecer, e este é o motivo.
   *
   * `Promise.race` entrega a rejeição tardia a uma corrida que já terminou, e
   * ali ela morre: sem log, sem `unhandledRejection`, sem rastro. O efeito é
   * que todo erro mais lento que o teto — conexão destruída, tempo de conexão
   * esgotado, statement cancelado pelo servidor — era apagado, e o único
   * registro que sobrava era a frase genérica de abandono.
   *
   * Foram três dias procurando causa em registros que a haviam engolido.
   * Diagnosticar com um instrumento que apaga a evidência é pior que não ter
   * instrumento, porque dá confiança em vez de dúvida.
   */
  trabalho.catch((erro: unknown) => {
    if (abandonada) {
      console.error(`${etapa} foi abandonada por tempo, e depois falhou assim:`, erro)
    }
  })

  return Promise.race([
    trabalho,
    new Promise<never>((_, rejeitar) => {
      // Só rejeita. Descartar o pool aqui seria mais um caminho capaz de
      // destruir conexão que outra requisição está usando.
      temporizador = setTimeout(() => {
        abandonada = true
        rejeitar(new Error(`${etapa} passou de ${segundos}s e foi abandonada`))
      }, segundos * 1000)
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
