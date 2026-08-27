import { describe, it, expect } from 'vitest'
import {
  hoje,
  formatarDia,
  somarDias,
  inicioDaSemana,
  inicioDoMes,
  fimDoMes,
  diasEntre,
} from '@/lib/visita/datas'

describe('formatarDia', () => {
  it('converte YYYY-MM-DD para DD/MM/AAAA sem passar por Date', () => {
    expect(formatarDia('2026-08-25')).toBe('25/08/2026')
  })
})

describe('hoje', () => {
  it('devolve a data no formato AAAA-MM-DD', () => {
    expect(hoje()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('somarDias', () => {
  it('soma e subtrai dias', () => {
    expect(somarDias('2026-08-25', 1)).toBe('2026-08-26')
    expect(somarDias('2026-08-25', -1)).toBe('2026-08-24')
  })

  it('atravessa virada de mês e de ano', () => {
    expect(somarDias('2026-08-31', 1)).toBe('2026-09-01')
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(somarDias('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('acerta 29 de fevereiro em ano bissexto', () => {
    expect(somarDias('2028-02-28', 1)).toBe('2028-02-29')
    expect(somarDias('2028-03-01', -1)).toBe('2028-02-29')
  })
})

describe('inicioDaSemana', () => {
  it('recua até a segunda-feira', () => {
    // 27/08/2026 é uma quinta.
    expect(inicioDaSemana('2026-08-27')).toBe('2026-08-24')
  })

  it('devolve a própria data quando já é segunda', () => {
    expect(inicioDaSemana('2026-08-24')).toBe('2026-08-24')
  })

  it('trata domingo como fim da semana, não como começo', () => {
    // O erro clássico: getUTCDay() devolve 0 para domingo, e uma conta
    // ingênua faria o domingo abrir a semana seguinte.
    expect(inicioDaSemana('2026-08-30')).toBe('2026-08-24')
  })

  it('atravessa a virada de mês', () => {
    // 01/09 é terça; a semana dela começou em agosto.
    expect(inicioDaSemana('2026-09-01')).toBe('2026-08-31')
  })

  it('atravessa a virada de ano', () => {
    // 01/01/2027 é uma sexta.
    expect(inicioDaSemana('2027-01-01')).toBe('2026-12-28')
  })
})

describe('inicioDoMes', () => {
  it('devolve o dia 1', () => {
    expect(inicioDoMes('2026-08-27')).toBe('2026-08-01')
    expect(inicioDoMes('2026-08-01')).toBe('2026-08-01')
  })
})

describe('fimDoMes', () => {
  it('acerta mês de 31 e de 30 dias', () => {
    expect(fimDoMes('2026-08-15')).toBe('2026-08-31')
    expect(fimDoMes('2026-04-10')).toBe('2026-04-30')
  })

  it('acerta fevereiro comum e bissexto', () => {
    expect(fimDoMes('2026-02-05')).toBe('2026-02-28')
    expect(fimDoMes('2028-02-05')).toBe('2028-02-29')
  })

  it('não vira o ano em dezembro', () => {
    expect(fimDoMes('2026-12-31')).toBe('2026-12-31')
  })
})

describe('diasEntre', () => {
  it('inclui as duas pontas', () => {
    const semana = diasEntre('2026-08-24', '2026-08-30')

    expect(semana).toHaveLength(7)
    expect(semana[0]).toBe('2026-08-24')
    expect(semana[6]).toBe('2026-08-30')
  })

  it('devolve um único dia quando as pontas são iguais', () => {
    expect(diasEntre('2026-08-25', '2026-08-25')).toEqual(['2026-08-25'])
  })

  it('atravessa virada de mês e de ano', () => {
    expect(diasEntre('2026-08-30', '2026-09-02')).toEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
    ])
    expect(diasEntre('2026-12-31', '2027-01-01')).toEqual(['2026-12-31', '2027-01-01'])
  })

  it('devolve vazio quando o fim vem antes do começo', () => {
    expect(diasEntre('2026-08-30', '2026-08-24')).toEqual([])
  })
})
