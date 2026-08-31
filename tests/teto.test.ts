import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { comTeto } from '@/lib/teto'

describe('comTeto', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('devolve o resultado quando a etapa termina dentro do prazo', async () => {
    const r = await comTeto('etapa', 8, async () => 'pronto')

    expect(r).toBe('pronto')
  })

  it('rejeita dizendo qual etapa passou do prazo', async () => {
    const promessa = comTeto('painel:consultas', 8, () => new Promise(() => {}))
    const capturada = promessa.catch((e: Error) => e.message)

    await vi.advanceTimersByTimeAsync(8_000)

    expect(await capturada).toBe('painel:consultas passou de 8s e foi abandonada')
  })

  /**
   * O caso que nos custou três dias de diagnóstico às cegas.
   *
   * `Promise.race` entrega a rejeição tardia a uma corrida que já terminou, e
   * ela some sem log e sem `unhandledRejection`. Todo erro que demore mais que
   * o teto para aparecer — conexão destruída, tempo de conexão esgotado,
   * statement cancelado pelo servidor — era engolido, e o único registro que
   * sobrava era a frase genérica do teto.
   */
  it('registra o erro real que chega depois de o prazo ter estourado', async () => {
    const registrado = vi.spyOn(console, 'error').mockImplementation(() => {})

    const promessa = comTeto(
      'painel:consultas',
      8,
      () => new Promise((_, rejeitar) => setTimeout(() => rejeitar(new Error('CONNECTION_DESTROYED')), 12_000))
    )
    promessa.catch(() => {})

    await vi.advanceTimersByTimeAsync(8_000)
    expect(registrado).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(4_000)

    expect(registrado).toHaveBeenCalledOnce()
    const [mensagem, causa] = registrado.mock.calls[0]
    expect(String(mensagem)).toContain('painel:consultas')
    expect(String((causa as Error).message)).toBe('CONNECTION_DESTROYED')
  })

  it('não registra nada quando a etapa termina bem depois do prazo', async () => {
    const registrado = vi.spyOn(console, 'error').mockImplementation(() => {})

    const promessa = comTeto(
      'painel:consultas',
      8,
      () => new Promise((resolver) => setTimeout(() => resolver('tarde, mas veio'), 12_000))
    )
    promessa.catch(() => {})

    await vi.advanceTimersByTimeAsync(12_000)

    expect(registrado).not.toHaveBeenCalled()
  })
})
