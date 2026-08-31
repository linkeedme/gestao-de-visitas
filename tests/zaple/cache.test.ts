import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { criarCacheDeChamada } from '@/lib/zaple/cache'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('criarCacheDeChamada', () => {
  it('não repete a busca dentro da validade', async () => {
    const buscar = vi.fn().mockResolvedValue('etapas')
    const cache = criarCacheDeChamada<string>(300_000)

    expect(await cache.obter('painel-1', buscar)).toBe('etapas')
    expect(await cache.obter('painel-1', buscar)).toBe('etapas')

    expect(buscar).toHaveBeenCalledOnce()
  })

  it('busca de novo depois de a validade vencer', async () => {
    const buscar = vi.fn().mockResolvedValue('etapas')
    const cache = criarCacheDeChamada<string>(300_000)

    await cache.obter('painel-1', buscar)
    vi.advanceTimersByTime(300_001)
    await cache.obter('painel-1', buscar)

    expect(buscar).toHaveBeenCalledTimes(2)
  })

  /**
   * Duas chamadas disparadas juntas abririam duas idas à rede idênticas. O
   * reagendar faz exatamente isso: sincroniza a visita fechada e a nova.
   */
  it('faz quem chega junto esperar a mesma chamada', async () => {
    const buscar = vi.fn().mockImplementation(() => Promise.resolve('etapas'))
    const cache = criarCacheDeChamada<string>(300_000)

    const [a, b] = await Promise.all([
      cache.obter('painel-1', buscar),
      cache.obter('painel-1', buscar),
    ])

    expect(buscar).toHaveBeenCalledOnce()
    expect([a, b]).toEqual(['etapas', 'etapas'])
  })

  /**
   * Guardar a recusa faria um soluço do CRM valer os cinco minutos inteiros —
   * e, pior, o mesmo erro voltaria para todo mundo sem ninguém ter tentado.
   */
  it('não guarda a falha', async () => {
    const buscar = vi.fn().mockRejectedValueOnce(new Error('502')).mockResolvedValue('etapas')
    const cache = criarCacheDeChamada<string>(300_000)

    await expect(cache.obter('painel-1', buscar)).rejects.toThrow('502')
    expect(await cache.obter('painel-1', buscar)).toBe('etapas')

    expect(buscar).toHaveBeenCalledTimes(2)
  })

  it('não confunde chaves diferentes', async () => {
    const buscar = vi.fn().mockResolvedValueOnce('do um').mockResolvedValueOnce('do dois')
    const cache = criarCacheDeChamada<string>(300_000)

    expect(await cache.obter('painel-1', buscar)).toBe('do um')
    expect(await cache.obter('painel-2', buscar)).toBe('do dois')
  })

  it('esquece o que estava guardado quando mandam esquecer', async () => {
    const buscar = vi.fn().mockResolvedValue('etapas')
    const cache = criarCacheDeChamada<string>(300_000)

    await cache.obter('painel-1', buscar)
    cache.esquecer()
    await cache.obter('painel-1', buscar)

    expect(buscar).toHaveBeenCalledTimes(2)
  })
})
