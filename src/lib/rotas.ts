export type FiltrosGestao = {
  de: string
  ate: string
  vendedor?: string
  status?: string
}

/**
 * O endereço da tela de gestão com os filtros que já estavam valendo.
 *
 * Cada controle da tela troca um filtro e precisa preservar os outros: mudar
 * o vendedor não pode devolver o gestor aos 30 dias padrão, e mudar a data
 * não pode apagar o status que ele acabou de escolher.
 *
 * String vazia apaga o filtro de propósito — é o que faz "limpar filtros" ser
 * um link como qualquer outro, sem JavaScript.
 */
export function linkDaGestao({ de, ate, vendedor, status }: FiltrosGestao): string {
  const p = new URLSearchParams({ de, ate })
  if (vendedor) p.set('vendedor', vendedor)
  if (status) p.set('status', status)
  return `/painel?${p}`
}
