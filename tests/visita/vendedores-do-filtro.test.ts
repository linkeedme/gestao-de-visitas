import { describe, it, expect } from 'vitest'
import { vendedoresDoFiltro, type KpiVendedor } from '@/lib/visita/relatorios'

/**
 * O filtro de vendedor da tela de gestão saía de uma consulta própria —
 * `selectDistinct` sobre o mesmo join, o mesmo intervalo e a mesma tabela que
 * `kpisPorVendedor` já percorre. Era uma ida ao banco inteira para devolver um
 * subconjunto do que a consulta anterior já tinha trazido.
 */
function kpi(usuarioId: string, vendedor: string, realizadas: number): KpiVendedor {
  return {
    usuarioId,
    vendedor,
    papel: 'vendedor',
    realizadas,
    canceladas: 0,
    reagendadas: 0,
    aFazer: 0,
    clientesAlcancados: 0,
    comRelato: 0,
    diasEmCampo: 0,
  }
}

describe('vendedoresDoFiltro', () => {
  it('devolve quem tem visita no período, em ordem alfabética', () => {
    const r = vendedoresDoFiltro([
      kpi('u2', 'Vitor Hugo', 9),
      kpi('u1', 'Ana Paula', 4),
      kpi('u3', 'Bruno', 7),
    ])

    expect(r).toEqual([
      { id: 'u1', nome: 'Ana Paula' },
      { id: 'u3', nome: 'Bruno' },
      { id: 'u2', nome: 'Vitor Hugo' },
    ])
  })

  /**
   * A ordem do filtro é alfabética de propósito, e não a da tabela: quem
   * procura uma pessoa numa lista procura pelo nome, não por quantas visitas
   * ela fez. A tabela ao lado continua ordenada por realizadas.
   */
  it('não herda a ordem por volume que a tabela usa', () => {
    const r = vendedoresDoFiltro([kpi('u1', 'Zilda', 30), kpi('u2', 'Alberto', 1)])

    expect(r.map((v) => v.nome)).toEqual(['Alberto', 'Zilda'])
  })

  it('devolve lista vazia quando ninguém tem visita no período', () => {
    expect(vendedoresDoFiltro([])).toEqual([])
  })
})
