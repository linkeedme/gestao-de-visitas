import { describe, it, expect, vi, beforeEach } from 'vitest'

const exigirUsuario = vi.fn()
const buscarVisita = vi.fn()
const editarVisita = vi.fn()
const espelharNoZaple = vi.fn()

vi.mock('@/lib/auth/atual', () => ({ exigirUsuario, exigirGestor: vi.fn(), usuarioAtual: vi.fn() }))
vi.mock('@/lib/visita/repositorio', () => ({ buscarVisita, editarVisita, apagarVisita: vi.fn(), db: {} }))
vi.mock('@/lib/zaple/visitas', () => ({ apagarCard: vi.fn() }))
vi.mock('@/lib/api/espelho', () => ({ espelharNoZaple }))

const params = Promise.resolve({ id: 'v1' })

const CONTATO = '44444444-4444-4444-4444-444444444444'

async function patch(corpo: unknown) {
  const { PATCH } = await import('@/app/api/visitas/[id]/route')
  return PATCH(
    new Request('http://local', { method: 'PATCH', body: JSON.stringify(corpo) }),
    { params }
  )
}

describe('PATCH /api/visitas/[id] — trocar o cliente', () => {
  beforeEach(() => {
    vi.resetModules()
    exigirUsuario.mockReset().mockResolvedValue({ id: 'u1', papel: 'vendedor' })
    buscarVisita.mockReset().mockResolvedValue({
      id: 'v1',
      usuarioId: 'u1',
      status: 'a_fazer',
      contatoId: '22222222-2222-2222-2222-222222222222',
      contatoNome: 'AUTOCAR',
    })
    editarVisita.mockReset().mockResolvedValue({ id: 'v1' })
    espelharNoZaple.mockReset().mockResolvedValue(undefined)
  })

  it('troca o cliente da visita', async () => {
    const r = await patch({ contatoId: CONTATO, contatoNome: '2F AUTO CENTER' })

    expect(r.status).toBe(200)
    expect(editarVisita).toHaveBeenCalledWith(
      {},
      'v1',
      expect.objectContaining({ contatoId: CONTATO, contatoNome: '2F AUTO CENTER' })
    )
  })

  /**
   * O nome fica congelado na visita para o relatório não depender do CRM nem
   * ser reescrito quando alguém renomeia um cliente. Trocar o cliente sem
   * trocar o nome deixaria a visita apontando para um contato e exibindo
   * outro — o pior dos dois mundos.
   */
  it('recusa trocar o cliente sem dizer o nome novo', async () => {
    const r = await patch({ contatoId: CONTATO })

    expect(r.status).toBe(400)
    expect(editarVisita).not.toHaveBeenCalled()
  })

  it('recusa nome de cliente sem o contato correspondente', async () => {
    const r = await patch({ contatoNome: '2F AUTO CENTER' })

    expect(r.status).toBe(400)
    expect(editarVisita).not.toHaveBeenCalled()
  })

  /**
   * Visita fechada é histórico: ela aconteceu com aquele cliente. Trocar
   * depois reescreveria o que o relatório do gestor já leu — mesma regra que
   * já vale para a data.
   */
  it('recusa trocar o cliente de visita que já aconteceu', async () => {
    buscarVisita.mockResolvedValue({
      id: 'v1',
      usuarioId: 'u1',
      status: 'realizada',
      contatoId: '22222222-2222-2222-2222-222222222222',
    })

    const r = await patch({ contatoId: CONTATO, contatoNome: '2F AUTO CENTER' })

    expect(r.status).toBe(409)
    expect(editarVisita).not.toHaveBeenCalled()
  })

  it('continua deixando editar título e motivo sem mexer no cliente', async () => {
    const r = await patch({ titulo: 'Novo título' })

    expect(r.status).toBe(200)
    expect(editarVisita).toHaveBeenCalledWith({}, 'v1', expect.objectContaining({ titulo: 'Novo título' }))
  })

  it('exige que o contato seja um identificador de verdade', async () => {
    const r = await patch({ contatoId: 'nao-e-uuid', contatoNome: 'X' })

    expect(r.status).toBe(400)
  })
})
