import { somarDias } from './datas'

/**
 * Os atalhos de período da tela de relatórios.
 *
 * `dias` é o quanto se recua a partir de hoje, não a duração: "30 dias" é 29
 * porque o intervalo inclui as duas pontas. Mexer nesses números quebra os
 * links antigos que ainda chegam com `?periodo=`.
 */
export const ATALHOS = [
  { dias: 6, rotulo: '7 dias' },
  { dias: 29, rotulo: '30 dias' },
  { dias: 89, rotulo: '90 dias' },
  { dias: 364, rotulo: '1 ano' },
] as const

/** O padrão quando não dá para entender o que veio na URL. */
const PADRAO = 29

/**
 * Dois anos. Acima disso não é pergunta de gestor, é URL digitada errada — e
 * uma consulta sem teto varreria a tabela inteira por causa de um dedo torto.
 */
const MAXIMO_DIAS = 731

export type Intervalo = { de: string; ate: string; atalhoAtivo: number | null }

export type ParamsPeriodo = { de?: string; ate?: string; periodo?: string }

/**
 * 'AAAA-MM-DD' que existe de verdade.
 *
 * O regex sozinho aprova `2026-02-30`. A ida e volta pelo Date pega isso: o
 * Date normaliza para 02/03 e a string deixa de bater.
 */
function dataValida(v: string | undefined): v is string {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const [ano, mes, dia] = v.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia)).toISOString().slice(0, 10) === v
}

/** Dias entre duas datas, pela conta em UTC que `clientesEmRisco` já usa. */
function distancia(de: string, ate: string): number {
  return Math.round(
    (Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000
  )
}

/**
 * Lê o período pedido na URL, com um intervalo utilizável em qualquer caso.
 *
 * Uma URL torta não é motivo para uma tela quebrada: em vez de erro na cara
 * do gestor, o filtro cai para os últimos 30 dias. Vive fora do componente
 * para ser testado sem renderizar nada, e para a tela e a rota do CSV lerem
 * o período pela mesma regra — quando cada uma fazia essa conta do seu jeito,
 * planilha e tela começavam a discordar.
 *
 * `hojeISO` entra por parâmetro para o teste fixar a data sem tocar no
 * relógio do processo.
 */
export function intervaloDoFiltro(params: ParamsPeriodo, hojeISO: string): Intervalo {
  const dePedido = dataValida(params.de) ? params.de : undefined
  const atePedido = dataValida(params.ate) ? params.ate : undefined

  let de: string
  let ate: string

  if (dePedido && atePedido && dePedido <= atePedido) {
    de = dePedido
    ate = atePedido
  } else if (dePedido && !atePedido) {
    de = dePedido
    // Um `de` no futuro sozinho deixaria o intervalo invertido; então a
    // pergunta vira "o que tem naquele dia", que é o que a pessoa digitou.
    ate = dePedido > hojeISO ? dePedido : hojeISO
  } else if (atePedido && !dePedido) {
    ate = atePedido
    de = somarDias(ate, -PADRAO)
  } else {
    // Cai aqui também quando `de` veio depois de `ate`: o pedido não faz
    // sentido, e inverter por conta própria seria adivinhar.
    const legado = Number(params.periodo)
    ate = hojeISO
    de = somarDias(ate, -(Number.isInteger(legado) && legado > 0 ? legado : PADRAO))
  }

  if (distancia(de, ate) > MAXIMO_DIAS) de = somarDias(ate, -MAXIMO_DIAS)

  const atalho = ATALHOS.find((a) => ate === hojeISO && de === somarDias(hojeISO, -a.dias))
  return { de, ate, atalhoAtivo: atalho?.dias ?? null }
}
