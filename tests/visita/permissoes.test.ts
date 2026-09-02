import { describe, it, expect } from 'vitest'
import { podeApagar } from '@/lib/visita/permissoes'

const GESTOR = { id: 'g1', papel: 'gestor' as const }
const VENDEDOR = { id: 'v1', papel: 'vendedor' as const }
const OUTRO = { id: 'v2', papel: 'vendedor' as const }

function visita(usuarioId: string, status: 'a_fazer' | 'realizada' | 'cancelada' | 'reagendada') {
  return { usuarioId, status }
}

describe('podeApagar', () => {
  it('deixa o gestor apagar qualquer visita, de qualquer pessoa', () => {
    expect(podeApagar(GESTOR, visita('v1', 'a_fazer'))).toBe(true)
    expect(podeApagar(GESTOR, visita('v1', 'realizada'))).toBe(true)
    expect(podeApagar(GESTOR, visita('v2', 'cancelada'))).toBe(true)
  })

  it('deixa o vendedor apagar a visita dele que ainda não aconteceu', () => {
    expect(podeApagar(VENDEDOR, visita('v1', 'a_fazer'))).toBe(true)
  })

  /**
   * Mesmo critério que já vale para editar: cada um mexe no que é seu. Apagar
   * a visita de outra pessoa é apagar trabalho registrado por ela.
   */
  it('não deixa o vendedor apagar visita de outra pessoa', () => {
    expect(podeApagar(OUTRO, visita('v1', 'a_fazer'))).toBe(false)
  })

  /**
   * Visita fechada é histórico: o relatório do gestor já a leu, e apagar
   * mudaria um número depois de ele ter sido usado numa conversa com a
   * equipe. Corrigir lançamento errado passa pelo gestor.
   */
  it('não deixa o vendedor apagar o que já aconteceu, nem a própria', () => {
    expect(podeApagar(VENDEDOR, visita('v1', 'realizada'))).toBe(false)
    expect(podeApagar(VENDEDOR, visita('v1', 'cancelada'))).toBe(false)
    expect(podeApagar(VENDEDOR, visita('v1', 'reagendada'))).toBe(false)
  })
})
