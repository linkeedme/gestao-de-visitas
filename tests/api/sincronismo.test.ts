import { describe, it, expect, vi, beforeEach } from 'vitest'

const exigirGestor = vi.fn()
const listarNaoSincronizadas = vi.fn()
const sincronizar = vi.fn()

vi.mock('@/lib/auth/atual', () => ({ exigirGestor, exigirUsuario: vi.fn(), usuarioAtual: vi.fn() }))
vi.mock('@/lib/visita/repositorio', () => ({ listarNaoSincronizadas, db: {} }))
vi.mock('@/lib/visita/sincronizador', () => ({ sincronizar }))

describe('/api/sincronismo', () => {
  beforeEach(() => {
    exigirGestor.mockReset()
    exigirGestor.mockResolvedValue({ id: 'g1', papel: 'gestor' })
    listarNaoSincronizadas.mockReset()
    listarNaoSincronizadas.mockResolvedValue([{ id: 'v1' }, { id: 'v2' }])
    sincronizar.mockReset()
    sincronizar.mockResolvedValue({ ok: true })
  })

  it('lista as visitas que não chegaram ao Zaple', async () => {
    const { GET } = await import('@/app/api/sincronismo/route')

    const r = await GET()

    expect((await r.json()).pendentes).toHaveLength(2)
  })

  it('reprocessa todas e conta os sucessos', async () => {
    sincronizar.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, erro: 'x' })
    const { POST } = await import('@/app/api/sincronismo/route')

    const corpo = await (await POST()).json()

    // A que falhou continua fora do CRM, então continua contando como restante.
    expect(corpo).toEqual({ tentadas: 2, sincronizadas: 1, restantes: 1 })
  })

  /**
   * O laço processava lotes em sequência sem orçamento de tempo nenhum.
   *
   * Cada visita faz até quatro chamadas ao CRM em série, e cada chamada tem
   * pior caso de dez segundos: quarenta por lote. Com vinte e oito pendências
   * o pior caso passava dos trezentos segundos da Vercel — a função morria, o
   * gestor não recebia nem a contagem parcial, e a instância ficava ocupada o
   * tempo inteiro.
   *
   * Agora ele para no orçamento e devolve o que conseguiu, dizendo quanto
   * sobrou. Apertar o botão de novo continua de onde parou.
   */
  it('para no orçamento de tempo e devolve o parcial com o que sobrou', async () => {
    vi.useFakeTimers()
    listarNaoSincronizadas.mockResolvedValue(
      Array.from({ length: 40 }, (_, i) => ({ id: `v${i}` }))
    )
    // Cada visita gasta cinco segundos de relógio.
    sincronizar.mockImplementation(async () => {
      vi.advanceTimersByTime(5_000)
      return { ok: true }
    })
    const { POST } = await import('@/app/api/sincronismo/route')

    const corpo = await (await POST()).json()

    expect(corpo.tentadas).toBe(40)
    expect(corpo.sincronizadas).toBeLessThan(40)
    expect(corpo.restantes).toBe(40 - corpo.sincronizadas)
    expect(sincronizar).not.toHaveBeenCalledTimes(40)
    vi.useRealTimers()
  })
})
