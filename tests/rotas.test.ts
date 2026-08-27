import { describe, it, expect } from 'vitest'
import { linkDaGestao } from '@/lib/rotas'

describe('linkDaGestao', () => {
  it('leva sempre o intervalo', () => {
    expect(linkDaGestao({ de: '2026-08-01', ate: '2026-08-27' })).toBe(
      '/painel?de=2026-08-01&ate=2026-08-27'
    )
  })

  it('acrescenta vendedor e status quando existem', () => {
    expect(
      linkDaGestao({ de: '2026-08-01', ate: '2026-08-27', vendedor: 'u1', status: 'realizada' })
    ).toBe('/painel?de=2026-08-01&ate=2026-08-27&vendedor=u1&status=realizada')
  })

  it('omite filtro vazio — é assim que "limpar filtros" funciona', () => {
    expect(linkDaGestao({ de: '2026-08-01', ate: '2026-08-27', vendedor: '', status: '' })).toBe(
      '/painel?de=2026-08-01&ate=2026-08-27'
    )
  })
})
