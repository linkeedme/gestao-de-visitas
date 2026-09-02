import { describe, it, expect, vi, beforeEach } from 'vitest'

const exigirUsuario = vi.fn()
const buscarVisita = vi.fn()
const apagarVisita = vi.fn()
const apagarCard = vi.fn()

vi.mock('@/lib/auth/atual', () => ({ exigirUsuario, exigirGestor: vi.fn(), usuarioAtual: vi.fn() }))
vi.mock('@/lib/visita/repositorio', () => ({ buscarVisita, apagarVisita, db: {} }))
vi.mock('@/lib/zaple/visitas', () => ({ apagarCard }))

const params = Promise.resolve({ id: 'v1' })
const chamar = async () => {
  const { DELETE } = await import('@/app/api/visitas/[id]/route')
  return DELETE(new Request('http://local', { method: 'DELETE' }), { params })
}

describe('DELETE /api/visitas/[id]', () => {
  beforeEach(() => {
    vi.resetModules()
    exigirUsuario.mockReset().mockResolvedValue({ id: 'u1', papel: 'vendedor' })
    buscarVisita.mockReset().mockResolvedValue({
      id: 'v1',
      usuarioId: 'u1',
      status: 'a_fazer',
      cardId: 'card-1',
    })
    apagarVisita.mockReset().mockResolvedValue({ id: 'v1' })
    apagarCard.mockReset().mockResolvedValue(undefined)
  })

  it('apaga a visita do próprio vendedor que ainda não aconteceu', async () => {
    const r = await chamar()

    expect(r.status).toBe(200)
    expect(apagarVisita).toHaveBeenCalledWith({}, 'v1')
  })

  it('apaga o card no CRM junto', async () => {
    await chamar()

    expect(apagarCard).toHaveBeenCalledWith('card-1')
  })

  it('não chama o CRM quando a visita nunca teve card', async () => {
    buscarVisita.mockResolvedValue({ id: 'v1', usuarioId: 'u1', status: 'a_fazer', cardId: null })

    await chamar()

    expect(apagarCard).not.toHaveBeenCalled()
  })

  /**
   * Apagar aqui não pode depender do CRM responder. A pessoa mandou apagar; se
   * o Zaple estiver fora do ar, a visita some daqui do mesmo jeito e a
   * resposta diz que o card ficou — em vez de deixar a tela travada num erro
   * que ela não tem como resolver.
   */
  it('apaga mesmo quando o CRM falha, e avisa que o card ficou lá', async () => {
    apagarCard.mockRejectedValue(new Error('Zaple fora do ar'))

    const r = await chamar()
    const corpo = await r.json()

    expect(r.status).toBe(200)
    expect(apagarVisita).toHaveBeenCalled()
    expect(corpo.cardApagado).toBe(false)
  })

  it('recusa apagar visita de outra pessoa', async () => {
    buscarVisita.mockResolvedValue({ id: 'v1', usuarioId: 'outro', status: 'a_fazer' })

    const r = await chamar()

    expect(r.status).toBe(403)
    expect(apagarVisita).not.toHaveBeenCalled()
  })

  it('recusa o vendedor apagar o que já aconteceu', async () => {
    buscarVisita.mockResolvedValue({ id: 'v1', usuarioId: 'u1', status: 'realizada' })

    const r = await chamar()

    expect(r.status).toBe(403)
    expect(apagarVisita).not.toHaveBeenCalled()
  })

  it('deixa o gestor apagar visita realizada de outra pessoa', async () => {
    exigirUsuario.mockResolvedValue({ id: 'g1', papel: 'gestor' })
    buscarVisita.mockResolvedValue({
      id: 'v1',
      usuarioId: 'outro',
      status: 'realizada',
      cardId: 'card-1',
    })

    const r = await chamar()

    expect(r.status).toBe(200)
    expect(apagarVisita).toHaveBeenCalled()
  })

  it('404 quando a visita não existe', async () => {
    buscarVisita.mockResolvedValue(null)

    expect((await chamar()).status).toBe(404)
  })
})
