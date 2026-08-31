/**
 * Quando, e como, oferecer a instalação do app na tela do celular.
 *
 * O vendedor vive na agenda, na rua, com uma mão só. Abrir pelo navegador
 * custa digitar endereço ou caçar aba; instalado, o app é um ícone ao lado do
 * WhatsApp e abre em tela cheia, sem barra de endereço comendo altura.
 *
 * Os dois sistemas fazem isso de formas diferentes, e é por isso que a decisão
 * mora aqui, separada da tela:
 *
 * - **Android/Chrome** avisa que a instalação é possível pelo evento
 *   `beforeinstallprompt`, e deixa o app chamar a caixa nativa na hora que
 *   quiser. É instalação de um toque.
 * - **iPhone** nunca dispara esse evento. No Safari o caminho é Compartilhar e
 *   "Adicionar à Tela de Início", e a única coisa que o app pode fazer é
 *   ensinar o caminho — o que só ajuda se for mostrado no lugar certo.
 */
export type Convite = 'nenhum' | 'nativo' | 'ensinar-ios'

/**
 * Quantos dias uma dispensa vale.
 *
 * Dispensar não é "nunca mais": quem recusou no primeiro dia pode querer
 * instalar depois de duas semanas usando pelo navegador. Insistir todo dia
 * seria propaganda; nunca mais voltar desperdiça o interesse que o uso cria.
 */
export const DISPENSA_DIAS = 14

export function decidirConvite({
  agora,
  jaInstalado,
  ehIOS,
  temPromptNativo,
  dispensadoEm,
}: {
  agora: number
  /** Rodando em janela de app, e não em aba de navegador. */
  jaInstalado: boolean
  ehIOS: boolean
  /** O navegador avisou que a instalação é possível. */
  temPromptNativo: boolean
  dispensadoEm: number | null
}): Convite {
  // Quem já instalou abre pela tela inicial: oferecer ali é oferecer o que a
  // pessoa já tem.
  if (jaInstalado) return 'nenhum'

  if (dispensadoEm !== null) {
    const dias = (agora - dispensadoEm) / (24 * 60 * 60 * 1000)
    if (dias < DISPENSA_DIAS) return 'nenhum'
  }

  // O nativo vem antes: onde ele existe, um toque resolve, e ensinar seria
  // pedir trabalho a quem não precisa fazer nenhum.
  if (temPromptNativo) return 'nativo'
  if (ehIOS) return 'ensinar-ios'

  // Sem aviso do navegador e fora do iPhone não há o que oferecer: pode ser
  // desktop, um navegador que não instala, ou o app já instalado noutra aba.
  return 'nenhum'
}

/** O iPhone e o iPad, incluindo o iPad que se apresenta como Mac com toque. */
export function detectarIOS(ua: string, temToque: boolean): boolean {
  if (/iPhone|iPad|iPod/i.test(ua)) return true
  return /Macintosh/i.test(ua) && temToque
}
