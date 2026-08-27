import { describe, it, expect } from 'vitest'
import { intervaloDoFiltro } from '@/lib/visita/periodo'

const HOJE = '2026-08-27'

describe('intervaloDoFiltro', () => {
  it('usa de e ate quando os dois são válidos e estão em ordem', () => {
    const r = intervaloDoFiltro({ de: '2026-07-15', ate: '2026-08-03' }, HOJE)

    expect(r).toEqual({ de: '2026-07-15', ate: '2026-08-03', atalhoAtivo: null })
  })

  it('completa com hoje quando só o de vem', () => {
    const r = intervaloDoFiltro({ de: '2026-08-01' }, HOJE)

    expect(r.de).toBe('2026-08-01')
    expect(r.ate).toBe(HOJE)
  })

  it('recua 29 dias quando só o ate vem', () => {
    const r = intervaloDoFiltro({ ate: '2026-08-03' }, HOJE)

    expect(r).toMatchObject({ de: '2026-07-05', ate: '2026-08-03' })
  })

  it('aceita período no futuro, para o gestor ver o que está marcado', () => {
    const r = intervaloDoFiltro({ de: '2026-09-01', ate: '2026-09-30' }, HOJE)

    expect(r).toMatchObject({ de: '2026-09-01', ate: '2026-09-30' })
  })

  it('mostra só aquele dia quando o de está no futuro e não veio ate', () => {
    // Completar com hoje deixaria o intervalo invertido.
    const r = intervaloDoFiltro({ de: '2026-09-10' }, HOJE)

    expect(r).toMatchObject({ de: '2026-09-10', ate: '2026-09-10' })
  })

  it('cai nos últimos 30 dias quando o formato não é data', () => {
    const r = intervaloDoFiltro({ de: 'ontem', ate: '03/08/2026' }, HOJE)

    expect(r).toMatchObject({ de: '2026-07-29', ate: HOJE })
  })

  it('descarta a data que não existe no calendário e honra a outra', () => {
    // 2026-02-30 casa com o regex e não existe: é o caso que um regex
    // sozinho deixa passar. Só a metade torta é descartada — jogar fora o
    // `ate` que o gestor digitou certo seria pior do que o erro dele.
    const r = intervaloDoFiltro({ de: '2026-02-30', ate: '2026-08-03' }, HOJE)

    expect(r).toMatchObject({ de: '2026-07-05', ate: '2026-08-03' })
  })

  it('cai nos últimos 30 dias quando as duas datas são impossíveis', () => {
    const r = intervaloDoFiltro({ de: '2026-02-30', ate: '2026-13-01' }, HOJE)

    expect(r).toMatchObject({ de: '2026-07-29', ate: HOJE })
  })

  it('cai nos últimos 30 dias quando o de vem depois do ate', () => {
    const r = intervaloDoFiltro({ de: '2026-08-20', ate: '2026-08-01' }, HOJE)

    expect(r).toMatchObject({ de: '2026-07-29', ate: HOJE })
  })

  it('apara intervalo maior que 731 dias, sem mexer no ate', () => {
    const r = intervaloDoFiltro({ de: '2020-01-01', ate: '2026-08-03' }, HOJE)

    // 731 dias antes de 03/08/2026 é 02/08/2024, não 03/08: nem 2025 nem
    // 2026 são bissextos, então dois anos ali somam 730 dias.
    expect(r.ate).toBe('2026-08-03')
    expect(r.de).toBe('2024-08-02')
  })

  it('traduz o parâmetro periodo antigo', () => {
    const r = intervaloDoFiltro({ periodo: '89' }, HOJE)

    expect(r).toMatchObject({ de: '2026-05-30', ate: HOJE })
  })

  it('ignora periodo quando de e ate vieram', () => {
    const r = intervaloDoFiltro({ de: '2026-08-01', ate: '2026-08-02', periodo: '364' }, HOJE)

    expect(r).toMatchObject({ de: '2026-08-01', ate: '2026-08-02' })
  })

  it('cai nos últimos 30 dias quando não vem nada', () => {
    const r = intervaloDoFiltro({}, HOJE)

    expect(r).toMatchObject({ de: '2026-07-29', ate: HOJE })
  })

  it('marca o atalho quando o intervalo bate com ele exatamente', () => {
    expect(intervaloDoFiltro({}, HOJE).atalhoAtivo).toBe(29)
    expect(intervaloDoFiltro({ periodo: '6' }, HOJE).atalhoAtivo).toBe(6)
    expect(intervaloDoFiltro({ de: '2026-08-21', ate: HOJE }, HOJE).atalhoAtivo).toBe(6)
  })

  it('não marca atalho nenhum quando o período é personalizado', () => {
    // Mesmo tamanho de um atalho, mas terminando ontem: não é o atalho.
    expect(intervaloDoFiltro({ de: '2026-08-20', ate: '2026-08-26' }, HOJE).atalhoAtivo).toBeNull()
  })
})
