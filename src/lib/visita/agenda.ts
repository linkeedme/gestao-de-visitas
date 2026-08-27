import { fimDoMes, inicioDaSemana, inicioDoMes, somarDias } from './datas'

export const VISTAS = ['dia', 'semana', 'mes'] as const

export type Vista = (typeof VISTAS)[number]

/**
 * A visão pedida na URL, ou o dia.
 *
 * O dia é o padrão porque é a visão do vendedor em campo, e é a única que
 * tem as ações de fechar visita. Uma `?vista=` desconhecida cai nela em vez
 * de quebrar a tela.
 */
export function vistaValida(v: unknown): Vista {
  return typeof v === 'string' && (VISTAS as readonly string[]).includes(v) ? (v as Vista) : 'dia'
}

/**
 * O intervalo que cada visão precisa consultar.
 *
 * No mês são as 42 células da grade, não os 31 dias: a grade sempre mostra o
 * fim do mês anterior e o começo do seguinte, e consultar só o mês deixaria
 * essas células vazias por construção — mentindo que a sexta-feira da virada
 * está livre bem no lugar onde mora metade do planejamento.
 */
export function intervaloDaVista(vista: Vista, data: string): { de: string; ate: string } {
  if (vista === 'semana') {
    const de = inicioDaSemana(data)
    return { de, ate: somarDias(de, 6) }
  }
  if (vista === 'mes') {
    const de = inicioDaSemana(inicioDoMes(data))
    return { de, ate: somarDias(de, 41) }
  }
  return { de: data, ate: data }
}

/**
 * Para onde as setas ‹ › levam, conforme a visão.
 *
 * O mês anda pelo dia 1 de propósito. Somar 30 ou 31 dias faria 31/01 virar
 * 02/03 — o mês de fevereiro sumiria da navegação e ninguém entenderia por
 * quê.
 */
export function passoDaVista(vista: Vista, data: string, direcao: 1 | -1): string {
  if (vista === 'semana') return somarDias(data, 7 * direcao)
  if (vista === 'mes') {
    const primeiro = inicioDoMes(data)
    return direcao === 1 ? somarDias(fimDoMes(primeiro), 1) : inicioDoMes(somarDias(primeiro, -1))
  }
  return somarDias(data, direcao)
}
