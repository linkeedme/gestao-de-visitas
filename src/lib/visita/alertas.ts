import type { Visita } from '@/lib/db'
import { formatarDia } from './datas'
import type { CadeiaReagendamento, ClienteEmRisco, LinhaRelatorio } from './relatorios'

export type Alerta = {
  chave: string
  n: number
  titulo: string
  ajuda: string
  tom: 'urgente' | 'atencao'
  detalhe: string[]
}

export type EntradasDeAlerta = {
  vencidas: LinhaRelatorio[]
  empurrados: CadeiaReagendamento[]
  semRelato: LinhaRelatorio[]
  emRisco: ClienteEmRisco[]
  foraDoCrm: Visita[]
}

/**
 * O cliente na frente, e quem e quando entre parênteses.
 *
 * Antes os três vinham separados por ponto, com o mesmo peso: "Davi Torres ·
 * Vitor Hugo Silva · 26/08/2026" — e quando o cliente e o vendedor têm nome
 * de gente, três nomes seguidos leem como repetição, não como informação. O
 * cliente é o que identifica o caso; o resto é contexto.
 */
function primeiroNome(nome: string): string {
  return nome.split(' ')[0]
}

/** Três exemplos bastam para reconhecer o problema; o resto está na lista. */
const EXEMPLOS = 3

/**
 * As cinco perguntas que o gestor precisa responder, em ordem de urgência.
 *
 * Estavam escritas à mão em duas telas, e duas delas apareciam nas duas — o
 * mesmo aviso contado duas vezes, em lugares diferentes. Como lista de dados,
 * a duplicação deixa de ser possível.
 *
 * Categoria vazia não vira alerta: um aviso que marca zero é ruído, e ruído
 * ensina o gestor a não olhar para o bloco inteiro.
 */
export function montarAlertas(e: EntradasDeAlerta): Alerta[] {
  const todos: Alerta[] = [
    {
      chave: 'atrasadas',
      n: e.vencidas.length,
      titulo: e.vencidas.length === 1 ? 'visita atrasada' : 'visitas atrasadas',
      ajuda: 'Data já passou e continuam a fazer.',
      tom: 'urgente',
      detalhe: e.vencidas
        .slice(0, EXEMPLOS)
        .map((v) => `${v.contatoNome} (${primeiroNome(v.vendedor)}, ${formatarDia(v.data)})`),
    },
    {
      chave: 'empurrados',
      n: e.empurrados.length,
      titulo:
        e.empurrados.length === 1 ? 'cliente reagendado em série' : 'clientes reagendados em série',
      ajuda: 'Empurrados duas vezes ou mais. É o negócio que morre sem ninguém perceber.',
      tom: 'urgente',
      detalhe: e.empurrados
        .slice(0, EXEMPLOS)
        .map((c) => `${c.contatoNome} (${c.vezes}×, ${primeiroNome(c.vendedor)})`),
    },
    {
      chave: 'sem-relato',
      n: e.semRelato.length,
      titulo: e.semRelato.length === 1 ? 'realizada sem relato' : 'realizadas sem relato',
      ajuda: 'Marcadas como feitas sem registro do que foi tratado — não dá para auditar.',
      tom: 'atencao',
      detalhe: e.semRelato
        .slice(0, EXEMPLOS)
        .map((v) => `${v.contatoNome} (${primeiroNome(v.vendedor)}, ${formatarDia(v.data)})`),
    },
    {
      chave: 'sem-visita',
      n: e.emRisco.length,
      titulo: e.emRisco.length === 1 ? 'cliente sem visita' : 'clientes sem visita',
      ajuda: 'Mais de 30 dias desde a última visita realizada.',
      tom: 'atencao',
      detalhe: e.emRisco.slice(0, EXEMPLOS).map((c) => `${c.contatoNome} (${c.diasSem} dias)`),
    },
    {
      chave: 'fora-do-crm',
      n: e.foraDoCrm.length,
      titulo: e.foraDoCrm.length === 1 ? 'visita fora do CRM' : 'visitas fora do CRM',
      ajuda: 'Deveriam ter virado card no Zaple e não viraram.',
      tom: 'atencao',
      detalhe: e.foraDoCrm
        .slice(0, EXEMPLOS)
        .map((v) => `${v.contatoNome} (${formatarDia(v.data)})`),
    },
  ]

  return todos.filter((a) => a.n > 0)
}
