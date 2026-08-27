import { describe, it, expect } from 'vitest'
import { nivelDeCarga, CARGA } from '@/lib/visita/carga'

describe('nivelDeCarga', () => {
  it('dia vazio é nível zero', () => {
    expect(nivelDeCarga(0)).toBe(0)
  })

  it('sobe de faixa nas fronteiras certas', () => {
    expect([1, 2].map(nivelDeCarga)).toEqual([1, 1])
    expect([3, 4].map(nivelDeCarga)).toEqual([2, 2])
    expect([5, 9, 40].map(nivelDeCarga)).toEqual([3, 3, 3])
  })

  it('número negativo não quebra a escala', () => {
    expect(nivelDeCarga(-1)).toBe(0)
  })

  it('todo nível tem par de cores', () => {
    expect(CARGA).toHaveLength(4)
    for (const c of CARGA) {
      expect(c.fundo).toBeTruthy()
      expect(c.texto).toBeTruthy()
    }
  })
})
