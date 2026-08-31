import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { criarBancoDeTeste, criarUsuarioDeTeste } from '../apoio/banco'
import { criarVisita, mudarStatus } from '@/lib/visita/repositorio'
import { totaisDoPeriodo } from '@/lib/visita/relatorios'

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>
let usuarioId: string
let zapleUserId: string | null

beforeEach(async () => {
  banco = await criarBancoDeTeste()
  const u = await criarUsuarioDeTeste(banco.db)
  usuarioId = u.id
  zapleUserId = u.zapleUserId
})

afterEach(async () => {
  await banco.fechar()
})

function entrada(data: string, contatoId: string, nome = 'AUTOCAR') {
  return { contatoId, contatoNome: nome, usuarioId, zapleUserId, data, titulo: nome }
}

const C1 = '22222222-2222-2222-2222-222222222222'
const C2 = '33333333-3333-3333-3333-333333333333'

describe('totaisDoPeriodo', () => {
  it('devolve tudo zerado quando não há visita nenhuma', async () => {
    const t = await totaisDoPeriodo(banco.db, '2026-08-01', '2026-08-31')

    expect(t).toEqual({
      visitas: 0,
      realizadas: 0,
      aFazer: 0,
      reagendadas: 0,
      canceladas: 0,
      clientes: 0,
      diasEmCampo: 0,
    })
  })

  it('conta as visitas do período e separa por situação', async () => {
    const a = await criarVisita(banco.db, entrada('2026-08-10', C1))
    await criarVisita(banco.db, entrada('2026-08-11', C2))
    await mudarStatus(banco.db, a.id, 'realizada', 'Conversamos sobre o pedido novo.')

    const t = await totaisDoPeriodo(banco.db, '2026-08-01', '2026-08-31')

    expect(t.visitas).toBe(2)
    expect(t.realizadas).toBe(1)
    expect(t.aFazer).toBe(1)
  })

  /**
   * O número que o gestor lê como "quantos clientes a operação alcançou".
   * Somar o alcance de cada vendedor daria outro número: dois vendedores que
   * visitam o mesmo cliente contariam duas vezes, e a carteira pareceria maior
   * do que é. Por isso o distinto é global, e não a soma das partes.
   */
  it('conta cliente atendido uma vez só, mesmo com várias visitas realizadas', async () => {
    const a = await criarVisita(banco.db, entrada('2026-08-10', C1))
    const b = await criarVisita(banco.db, entrada('2026-08-20', C1))
    await mudarStatus(banco.db, a.id, 'realizada', 'Primeira conversa do mês.')
    await mudarStatus(banco.db, b.id, 'realizada', 'Retorno para fechar o pedido.')

    const t = await totaisDoPeriodo(banco.db, '2026-08-01', '2026-08-31')

    expect(t.visitas).toBe(2)
    expect(t.clientes).toBe(1)
  })

  /** Só visita realizada conta como cliente alcançado: agendar não é atender. */
  it('não conta como cliente quem só tem visita marcada', async () => {
    await criarVisita(banco.db, entrada('2026-08-10', C1))

    const t = await totaisDoPeriodo(banco.db, '2026-08-01', '2026-08-31')

    expect(t.clientes).toBe(0)
  })

  it('conta os dias distintos em que houve visita realizada', async () => {
    const a = await criarVisita(banco.db, entrada('2026-08-10', C1))
    const b = await criarVisita(banco.db, entrada('2026-08-10', C2))
    await mudarStatus(banco.db, a.id, 'realizada', 'Uma conversa no mesmo dia.')
    await mudarStatus(banco.db, b.id, 'realizada', 'Outra conversa no mesmo dia.')

    const t = await totaisDoPeriodo(banco.db, '2026-08-01', '2026-08-31')

    expect(t.diasEmCampo).toBe(1)
  })

  it('respeita as duas bordas do intervalo', async () => {
    await criarVisita(banco.db, entrada('2026-07-31', C1))
    await criarVisita(banco.db, entrada('2026-08-01', C1))
    await criarVisita(banco.db, entrada('2026-08-31', C1))
    await criarVisita(banco.db, entrada('2026-09-01', C1))

    const t = await totaisDoPeriodo(banco.db, '2026-08-01', '2026-08-31')

    expect(t.visitas).toBe(2)
  })
})
