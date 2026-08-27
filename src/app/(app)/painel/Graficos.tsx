import { formatarDia } from '@/lib/visita/datas'
import type { DiaSerie, KpiVendedor } from '@/lib/visita/relatorios'

/**
 * As cores de status, validadas contra daltonismo e contraste.
 *
 * Rodadas pelo validador da disciplina de visualização: banda de luminosidade,
 * piso de croma, separação sob protanopia/deuteranopia e contraste ≥ 3:1 contra
 * a superfície. O âmbar e o cinza foram escurecidos em relação aos originais
 * do app porque ficavam em 2,7:1 e 2,5:1 — numa barra fina isso desaparece.
 *
 * Cancelada continua CINZA de propósito, e o validador reclama disso: para uma
 * paleta categórica, cinza não distingue identidade. Aqui é status, e cinza é o
 * significado — cancelar não é alarme, é desfecho. A regra que isso obriga a
 * cumprir é a de sempre acompanhar cor de rótulo, nunca cor sozinha.
 */
export const CORES = {
  realizadas: '#0e8a5f',
  aFazer: '#1f6fb2',
  reagendadas: '#b8730a',
  canceladas: '#64748b',
} as const

export const SERIES = [
  { chave: 'realizadas', rotulo: 'Realizadas' },
  { chave: 'aFazer', rotulo: 'A fazer' },
  { chave: 'reagendadas', rotulo: 'Reagendadas' },
  { chave: 'canceladas', rotulo: 'Canceladas' },
] as const

export function Legenda() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1">
      {SERIES.map((s) => (
        <li key={s.chave} className="flex items-center gap-1.5 text-sm text-slate-600">
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: CORES[s.chave] }}
            aria-hidden="true"
          />
          {s.rotulo}
        </li>
      ))}
    </ul>
  )
}

/**
 * Barras empilhadas por dia.
 *
 * Empilhada porque a pergunta é "quanto de trabalho no dia, e de que tipo" —
 * o total importa tanto quanto a divisão. Linhas separadas responderiam
 * "como cada status evoluiu", que não é o que o gestor olha aqui.
 */
export function BarrasPorDia({ serie }: { serie: DiaSerie[] }) {
  const maximo = Math.max(
    1,
    ...serie.map((d) => d.realizadas + d.aFazer + d.reagendadas + d.canceladas)
  )
  const total = serie.reduce(
    (n, d) => n + d.realizadas + d.aFazer + d.reagendadas + d.canceladas,
    0
  )

  if (total === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
        Nenhuma visita no período.
      </p>
    )
  }

  // Muitos dias em pouca largura viram tiras de um pixel: acima de 45 dias o
  // gráfico passa a mostrar só os dias com movimento, que é o que se lê mesmo.
  const dias = serie.length > 45 ? serie.filter((d) => d.realizadas + d.aFazer + d.reagendadas + d.canceladas > 0) : serie

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-[2px] overflow-x-auto pb-1" style={{ height: 160 }}>
        {dias.map((d) => {
          const soma = d.realizadas + d.aFazer + d.reagendadas + d.canceladas
          const altura = soma === 0 ? 0 : (soma / maximo) * 100
          return (
            <div
              key={d.data}
              className="group relative flex min-w-[8px] flex-1 flex-col justify-end"
              style={{ height: '100%' }}
            >
              {/* Dia sem visita ganha um traço na base. Sem ele, um mês com
                  movimento só no fim vira um gráfico com metade vazia que lê
                  como falha de renderização, e não como o que é: dias em que
                  ninguém saiu a campo. */}
              {soma === 0 && <div className="h-[3px] w-full rounded-sm bg-slate-300" />}

              <div
                className="flex w-full flex-col-reverse overflow-hidden rounded-t"
                style={{ height: `${altura}%` }}
              >
                {SERIES.map((s) => {
                  const n = d[s.chave]
                  if (n === 0) return null
                  return (
                    <div
                      key={s.chave}
                      // O anel de 2px na cor da superfície é o espaçador entre
                      // segmentos: sem ele, verde colado em azul lê como uma
                      // faixa só de cor ambígua.
                      style={{
                        height: `${(n / soma) * 100}%`,
                        backgroundColor: CORES[s.chave],
                        boxShadow: 'inset 0 -2px 0 0 var(--color-nevoa)',
                      }}
                    />
                  )
                })}
              </div>

              <div
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-asfalto px-2.5 py-1.5 text-xs text-white group-hover:block"
              >
                <span className="font-semibold">{formatarDia(d.data)}</span>
                {soma === 0 ? (
                  <span className="block text-white/60">sem visita</span>
                ) : (
                  SERIES.filter((s) => d[s.chave] > 0).map((s) => (
                    <span key={s.chave} className="block text-white/80">
                      {d[s.chave]} {s.rotulo.toLowerCase()}
                    </span>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex justify-between text-xs text-slate-400">
        <span>{formatarDia(dias[0]?.data ?? '')}</span>
        <span>{formatarDia(dias[dias.length - 1]?.data ?? '')}</span>
      </div>
    </div>
  )
}

/**
 * Barras horizontais por pessoa.
 *
 * Horizontal porque nome de gente é longo: em barra vertical o rótulo vira
 * texto girado, que ninguém lê de relance.
 */
export function BarrasPorPessoa({ linhas }: { linhas: KpiVendedor[] }) {
  const maximo = Math.max(
    1,
    ...linhas.map((l) => l.realizadas + l.aFazer + l.reagendadas + l.canceladas)
  )

  if (linhas.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
        Nenhuma visita no período.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {linhas.map((l) => {
        const soma = l.realizadas + l.aFazer + l.reagendadas + l.canceladas
        return (
          <div key={l.usuarioId} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-semibold">{l.vendedor}</span>
              {/* O alcance responde o que o volume esconde: dez visitas em dois
                  clientes não é o mesmo trabalho que dez em dez. */}
              <span className="shrink-0 text-xs text-slate-500">
                <span className="font-display text-sm font-semibold text-slate-700">{soma}</span>{' '}
                visitas · {l.clientesAlcancados}{' '}
                {l.clientesAlcancados === 1 ? 'cliente' : 'clientes'}
              </span>
            </div>
            <div className="flex h-5 gap-[2px]" style={{ width: `${(soma / maximo) * 100}%` }}>
              {SERIES.map((s) => {
                const n = l[s.chave]
                if (n === 0) return null
                return (
                  <div
                    key={s.chave}
                    className="group relative first:rounded-l last:rounded-r"
                    style={{ width: `${(n / soma) * 100}%`, backgroundColor: CORES[s.chave] }}
                  >
                    {/* Rótulo direto quando o segmento comporta: o número na
                        barra dispensa contar cor contra legenda. */}
                    {n / soma > 0.15 && (
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white">
                        {n}
                      </span>
                    )}
                    <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-asfalto px-2.5 py-1.5 text-xs text-white group-hover:block">
                      {n} {s.rotulo.toLowerCase()}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Distribuição por tipo — barras, não pizza: comparar comprimento é mais fácil que ângulo. */
export function PorTipo({ fatias }: { fatias: { rotulo: string; n: number }[] }) {
  const total = fatias.reduce((n, f) => n + f.n, 0)
  const maximo = Math.max(1, ...fatias.map((f) => f.n))

  if (total === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
        Nenhuma visita no período.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      {fatias.map((f) => (
        <div key={f.rotulo} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-sm text-slate-600">{f.rotulo}</span>
          <div className="h-4 flex-1 overflow-hidden rounded bg-slate-100">
            <div
              className="h-full rounded"
              style={{ width: `${(f.n / maximo) * 100}%`, backgroundColor: CORES.aFazer }}
            />
          </div>
          <span className="w-16 shrink-0 text-right font-display text-sm font-semibold">
            {f.n}
            <span className="ml-1 font-sans text-xs font-normal text-slate-400">
              {Math.round((f.n / total) * 100)}%
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}
