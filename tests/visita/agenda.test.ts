import { describe, it, expect } from 'vitest'
import { vistaValida, intervaloDaVista, passoDaVista } from '@/lib/visita/agenda'

describe('vistaValida', () => {
  it('aceita as três visões conhecidas', () => {
    expect(vistaValida('dia')).toBe('dia')
    expect(vistaValida('semana')).toBe('semana')
    expect(vistaValida('mes')).toBe('mes')
  })

  it('cai no dia diante de qualquer outra coisa', () => {
    // A visão do vendedor em campo é o dia; é ela que tem as ações.
    expect(vistaValida('ano')).toBe('dia')
    expect(vistaValida(undefined)).toBe('dia')
    expect(vistaValida(['semana'])).toBe('dia')
  })
})

describe('intervaloDaVista', () => {
  it('no dia, é o próprio dia nas duas pontas', () => {
    expect(intervaloDaVista('dia', '2026-08-27')).toEqual({ de: '2026-08-27', ate: '2026-08-27' })
  })

  it('na semana, vai de segunda a domingo', () => {
    // 27/08/2026 é quinta.
    expect(intervaloDaVista('semana', '2026-08-27')).toEqual({
      de: '2026-08-24',
      ate: '2026-08-30',
    })
  })

  it('no mês, cobre as 42 células da grade, não só o mês', () => {
    // Agosto/2026 começa num sábado: a grade abre em 27/07 e fecha em 06/09.
    // Consultar só 01/08–31/08 deixaria as vizinhas sempre em branco,
    // mentindo que aquela sexta da virada está livre.
    expect(intervaloDaVista('mes', '2026-08-27')).toEqual({ de: '2026-07-27', ate: '2026-09-06' })
  })

  it('no mês, o intervalo não depende de qual dia do mês veio', () => {
    expect(intervaloDaVista('mes', '2026-08-01')).toEqual(intervaloDaVista('mes', '2026-08-31'))
  })
})

describe('passoDaVista', () => {
  it('anda um dia por vez na visão de dia', () => {
    expect(passoDaVista('dia', '2026-08-27', 1)).toBe('2026-08-28')
    expect(passoDaVista('dia', '2026-08-27', -1)).toBe('2026-08-26')
  })

  it('anda sete dias por vez na semana', () => {
    expect(passoDaVista('semana', '2026-08-27', 1)).toBe('2026-09-03')
    expect(passoDaVista('semana', '2026-08-27', -1)).toBe('2026-08-20')
  })

  it('anda de mês em mês pelo dia 1, sem escorregar', () => {
    // Somar 30 ou 31 dias faria 31/01 virar 02/03 ou 03/03. Andar pelo
    // primeiro dia do mês é a única conta que não escorrega.
    expect(passoDaVista('mes', '2026-08-27', 1)).toBe('2026-09-01')
    expect(passoDaVista('mes', '2026-08-27', -1)).toBe('2026-07-01')
    expect(passoDaVista('mes', '2026-01-31', 1)).toBe('2026-02-01')
    expect(passoDaVista('mes', '2026-03-31', -1)).toBe('2026-02-01')
  })

  it('atravessa a virada de ano nos dois sentidos', () => {
    expect(passoDaVista('mes', '2026-12-15', 1)).toBe('2027-01-01')
    expect(passoDaVista('mes', '2026-01-15', -1)).toBe('2025-12-01')
  })
})
