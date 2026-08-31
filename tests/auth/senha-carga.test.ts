import { describe, it, expect, vi } from 'vitest'
import bcrypt from 'bcryptjs'

/**
 * Carregar o módulo de senha não pode custar trabalho de CPU.
 *
 * Havia um `bcrypt.hashSync` de custo 12 rodando na carga, só para produzir um
 * hash de referência que nunca muda. São 221ms medidos num Mac, e provavelmente
 * de meio a um segundo e meio numa vCPU compartilhada da Vercel.
 *
 * O problema não é o tempo em si, é ser SÍNCRONO: enquanto roda, nada mais
 * acontece na instância — nem outras requisições, nem a leitura dos sockets do
 * Postgres. E acontece no primeiro acesso de qualquer rota que importe este
 * módulo, que são o login e as duas de usuários.
 */
describe('carga do módulo de senha', () => {
  it('não gasta CPU ao ser carregado', async () => {
    // Primeiro import só para aquecer a transformação do arquivo; o que
    // interessa medir é a execução do corpo do módulo, não a compilação.
    await import('@/lib/auth/senha')
    vi.resetModules()

    const t = Date.now()
    await import('@/lib/auth/senha')
    const gasto = Date.now() - t

    expect(gasto).toBeLessThan(50)
  })
})

describe('hash de referência', () => {
  it('é um bcrypt de custo 12, para gastar o mesmo tempo de uma senha real', async () => {
    const { HASH_FANTASMA } = await import('@/lib/auth/senha')

    expect(HASH_FANTASMA).toMatch(/^\$2[aby]\$12\$/)
  })

  /**
   * A defesa contra descobrir quais telefones existem na base depende disto:
   * sem usuário, a comparação precisa acontecer mesmo assim, contra um hash
   * válido. Um valor que o bcrypt recusasse voltaria na hora e devolveria o
   * tempo de resposta como pista.
   */
  it('é aceito pelo bcrypt e não corresponde a senha nenhuma', async () => {
    const { HASH_FANTASMA } = await import('@/lib/auth/senha')

    await expect(bcrypt.compare('123456', HASH_FANTASMA)).resolves.toBe(false)
    await expect(bcrypt.compare('', HASH_FANTASMA)).resolves.toBe(false)
  })
})
