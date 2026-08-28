import { describe, it, expect, afterEach } from 'vitest'
import { numeroDoAmbiente } from '@/lib/ambiente'

const NOME = 'VARIAVEL_DE_TESTE'

afterEach(() => {
  delete process.env[NOME]
})

describe('numeroDoAmbiente', () => {
  it('usa o valor quando ele é um número válido', () => {
    process.env[NOME] = '1500'
    expect(numeroDoAmbiente(NOME, 10)).toBe(1500)
  })

  it('cai no padrão quando a variável não existe', () => {
    expect(numeroDoAmbiente(NOME, 10)).toBe(10)
  })

  /**
   * O caso que motivou a função. Variável criada em branco no painel da
   * Vercel chega como string vazia, não como ausente — então `??` não
   * dispara, `Number('')` devolve zero, e o zero vira pool que não conecta ou
   * janela que descarta a conexão a cada consulta.
   */
  it('CAI NO PADRÃO com string vazia, em vez de virar zero', () => {
    process.env[NOME] = ''
    expect(numeroDoAmbiente(NOME, 10)).toBe(10)
  })

  it('cai no padrão com só espaços', () => {
    process.env[NOME] = '   '
    expect(numeroDoAmbiente(NOME, 10)).toBe(10)
  })

  it('cai no padrão com texto que não é número', () => {
    process.env[NOME] = 'oito segundos'
    expect(numeroDoAmbiente(NOME, 10)).toBe(10)
  })

  // Nenhum ajuste deste projeto tem zero ou negativo como valor útil: é
  // sempre pool, prazo ou janela.
  it('cai no padrão com zero e com negativo', () => {
    process.env[NOME] = '0'
    expect(numeroDoAmbiente(NOME, 10)).toBe(10)
    process.env[NOME] = '-1'
    expect(numeroDoAmbiente(NOME, 10)).toBe(10)
  })

  it('cai no padrão com Infinity', () => {
    process.env[NOME] = 'Infinity'
    expect(numeroDoAmbiente(NOME, 10)).toBe(10)
  })
})
