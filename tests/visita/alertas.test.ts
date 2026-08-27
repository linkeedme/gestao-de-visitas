import { describe, it, expect } from 'vitest'
import { montarAlertas } from '@/lib/visita/alertas'

const vazio = { vencidas: [], empurrados: [], semRelato: [], emRisco: [], foraDoCrm: [] }
const umaVencida = [{ contatoNome: 'AUTOCAR', vendedor: 'Vitor', data: '2026-08-20' }] as never

describe('montarAlertas', () => {
  it('não devolve alerta quando não há problema', () => {
    expect(montarAlertas(vazio)).toEqual([])
  })

  it('omite a categoria vazia — alerta zerado é ruído', () => {
    const r = montarAlertas({ ...vazio, vencidas: umaVencida })

    expect(r).toHaveLength(1)
    expect(r[0].chave).toBe('atrasadas')
  })

  it('põe o urgente antes do informativo', () => {
    const r = montarAlertas({
      ...vazio,
      emRisco: [{ contatoNome: 'CASA', diasSem: 45 }] as never,
      vencidas: umaVencida,
    })

    expect(r.map((a) => a.chave)).toEqual(['atrasadas', 'sem-visita'])
  })

  it('mostra no máximo três exemplos, mas conta todos', () => {
    const cinco = Array.from({ length: 5 }, (_, i) => ({
      contatoNome: `C${i}`,
      vendedor: 'Vitor',
      data: '2026-08-20',
    })) as never

    const [a] = montarAlertas({ ...vazio, vencidas: cinco })

    expect(a.n).toBe(5)
    expect(a.detalhe).toHaveLength(3)
  })

  it('usa singular quando é um só', () => {
    const [a] = montarAlertas({ ...vazio, vencidas: umaVencida })

    expect(a.titulo).toBe('visita atrasada')
  })
})
