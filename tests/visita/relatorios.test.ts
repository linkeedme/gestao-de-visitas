import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { criarBancoDeTeste, criarUsuarioDeTeste } from '../apoio/banco'
import { criarVisita } from '@/lib/visita/repositorio'
import { listarParaAuditoria } from '@/lib/visita/relatorios'

const CONTATO = '22222222-2222-2222-2222-222222222222'

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

function entrada(data: string) {
  return {
    contatoId: CONTATO,
    contatoNome: 'AUTOCAR',
    usuarioId,
    zapleUserId,
    data,
    titulo: 'AUTOCAR',
  }
}

describe('listarParaAuditoria', () => {
  it('inclui as duas bordas do intervalo e exclui o que está fora', async () => {
    // Um dia antes, as duas pontas, e um dia depois. Com `>` no lugar de
    // `>=` o gestor perderia silenciosamente o primeiro dia do mês.
    await criarVisita(banco.db, entrada('2026-07-31'))
    await criarVisita(banco.db, entrada('2026-08-01'))
    await criarVisita(banco.db, entrada('2026-08-15'))
    await criarVisita(banco.db, entrada('2026-08-31'))
    await criarVisita(banco.db, entrada('2026-09-01'))

    const linhas = await listarParaAuditoria(banco.db, { de: '2026-08-01', ate: '2026-08-31' })

    expect(linhas.map((l) => l.data).sort()).toEqual(['2026-08-01', '2026-08-15', '2026-08-31'])
  })

  it('aceita intervalo no futuro', async () => {
    await criarVisita(banco.db, entrada('2026-09-10'))

    const linhas = await listarParaAuditoria(banco.db, { de: '2026-09-01', ate: '2026-09-30' })

    expect(linhas).toHaveLength(1)
  })

  it('combina o filtro de status com o de período', async () => {
    await criarVisita(banco.db, entrada('2026-08-15'))

    const aFazer = await listarParaAuditoria(banco.db, {
      de: '2026-08-01',
      ate: '2026-08-31',
      status: 'a_fazer',
    })
    const realizadas = await listarParaAuditoria(banco.db, {
      de: '2026-08-01',
      ate: '2026-08-31',
      status: 'realizada',
    })

    expect(aFazer).toHaveLength(1)
    expect(realizadas).toHaveLength(0)
  })
})
