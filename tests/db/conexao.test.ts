import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * A política de reaproveitamento da conexão, que é onde mora o travamento.
 *
 * O driver é substituído porque o que está sob teste não é o SQL: é quantas
 * vezes o módulo decide abrir conexão nova. Isso só se observa contando
 * aberturas, e o driver é a fronteira certa para isso.
 */
const abertas: Array<{ end: ReturnType<typeof vi.fn> }> = []

vi.mock('postgres', () => ({
  default: vi.fn(() => {
    const cliente = { end: vi.fn().mockResolvedValue(undefined) }
    abertas.push(cliente)
    return cliente
  }),
}))

vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: vi.fn((cliente: unknown) => ({ cliente })),
}))

/** Uma consulta qualquer: o Proxy conecta ao primeiro acesso de propriedade. */
async function consultar() {
  const { db } = await import('@/lib/db')
  void (db as unknown as Record<string, unknown>).cliente
}

describe('conexão entre requisições', () => {
  beforeEach(() => {
    abertas.length = 0
    vi.resetModules()
    vi.useFakeTimers()
    process.env.DATABASE_URL = 'postgres://teste/banco'
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reaproveita a conexão dentro da mesma requisição', async () => {
    await consultar()
    await consultar()

    expect(abertas).toHaveLength(1)
  })

  /**
   * O caso que travava em produção. A Vercel congela a função entre
   * requisições em vez de encerrá-la: o socket morre durante a soneca, mas o
   * módulo acorda achando que ainda tem conexão boa. A consulta é escrita num
   * cano sem ninguém do outro lado e espera uma resposta que não vem.
   *
   * A verificação por idade tem que continuar valendo para qualquer rota,
   * inclusive as que ainda não existem: a versão anterior descartava a
   * conexão na saída da requisição e dependia de cada rota se registrar, o
   * que as oito de `/api` e o login não faziam.
   */
  it('não reaproveita a conexão que atravessou a soneca da instância', async () => {
    await consultar()

    vi.advanceTimersByTime(30_000)
    await consultar()

    expect(abertas).toHaveLength(2)
  })
})
