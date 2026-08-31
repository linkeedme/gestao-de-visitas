/**
 * Cache curto para uma chamada ao CRM, com dedupe de quem chega junto.
 *
 * Existia só para as etapas do painel. As outras duas listas que o CRM
 * responde — os agentes e os campos de contato — ficaram de fora, e são
 * justamente as que estão no caminho de renderizar a tela de Equipe, que é
 * `force-dynamic`: toda navegação para lá era uma ida à rede antes de qualquer
 * HTML sair, com pior caso de dez segundos.
 *
 * As três listas mudam quando alguém mexe na configuração do CRM, o que é raro
 * e nunca urgente. Uma janela curta tira a chamada do caminho de quem está
 * clicando sem esconder mudança por muito tempo.
 */
export type CacheDeChamada<T> = {
  obter(chave: string, buscar: () => Promise<T>): Promise<T>
  /** Esquece o que está guardado. Para teste e para os scripts de conferência. */
  esquecer(): void
}

export function criarCacheDeChamada<T>(validadeMs: number): CacheDeChamada<T> {
  let guardado: { chave: string; valor: T; em: number } | undefined

  /**
   * A busca que já está a caminho.
   *
   * Sem isto, duas chamadas disparadas juntas abririam duas idas idênticas ao
   * CRM. O reagendar faz exatamente isso: sincroniza a visita fechada e a nova.
   */
  let emVoo: { chave: string; promessa: Promise<T> } | undefined

  return {
    async obter(chave, buscar) {
      const agora = Date.now()

      if (guardado && guardado.chave === chave && agora - guardado.em < validadeMs) {
        return guardado.valor
      }
      if (emVoo && emVoo.chave === chave) return emVoo.promessa

      const promessa = buscar()
      emVoo = { chave, promessa }

      try {
        const valor = await promessa
        // Só o sucesso entra: guardar a recusa faria um soluço do CRM valer a
        // janela inteira, e devolveria o mesmo erro a todo mundo sem ninguém
        // ter chegado a tentar de novo.
        guardado = { chave, valor, em: Date.now() }
        return valor
      } finally {
        if (emVoo?.promessa === promessa) emVoo = undefined
      }
    },

    esquecer() {
      guardado = undefined
      emVoo = undefined
    },
  }
}
