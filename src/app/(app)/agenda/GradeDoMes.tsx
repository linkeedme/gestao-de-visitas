import Link from 'next/link'
import type { ContagemDoDia } from '@/lib/visita/repositorio'

/**
 * O mês inteiro em contadores.
 *
 * Não carrega as visitas de propósito: um mês cheio de uma equipe pequena
 * passa de 300 linhas, e o que a célula mostra são quatro números. A conta
 * vem agregada do banco.
 *
 * As células das pontas são os dias do mês vizinho, em cinza e igualmente
 * clicáveis — a última semana de julho aparece na tela de agosto, e é ali
 * que mora metade do planejamento da virada.
 */

const CURTOS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']

const PONTOS = [
  { chave: 'aFazer', cor: 'bg-fazer', rotulo: 'a fazer' },
  { chave: 'realizadas', cor: 'bg-feita', rotulo: 'realizadas' },
  { chave: 'reagendadas', cor: 'bg-adiada', rotulo: 'reagendadas' },
  { chave: 'canceladas', cor: 'bg-morta', rotulo: 'canceladas' },
] as const

export function GradeDoMes({
  dias,
  mesCorrente,
  contagens,
  hojeISO,
  linkDoDia,
}: {
  dias: string[]
  /** 'AAAA-MM' do mês que a tela está mostrando. */
  mesCorrente: string
  contagens: ContagemDoDia[]
  hojeISO: string
  linkDoDia: (data: string) => string
}) {
  // O banco só devolve dias que tiveram visita; os outros entram com zero.
  // Um dia vazio é informação — é justamente o buraco que esta visão existe
  // para mostrar.
  const porDia = new Map(contagens.map((c) => [c.data, c]))

  return (
    <div className="overflow-hidden rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200/70">
      <div className="grid grid-cols-7">
        {CURTOS.map((c) => (
          <div
            key={c}
            className="pb-1 text-center text-xs font-bold uppercase tracking-wide text-slate-400"
          >
            {c}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {dias.map((d) => {
          const c = porDia.get(d)
          const total = c ? c.aFazer + c.realizadas + c.reagendadas + c.canceladas : 0
          const doMes = d.slice(0, 7) === mesCorrente
          const ehHoje = d === hojeISO

          return (
            <Link
              key={d}
              href={linkDoDia(d)}
              aria-label={`${Number(d.slice(8, 10))} — ${total} ${total === 1 ? 'visita' : 'visitas'}`}
              // Altura fixa: sem ela a grade pularia de tamanho ao trocar de
              // mês, conforme os dias cheios caíssem em linhas diferentes.
              className={`flex h-20 flex-col rounded-xl p-1.5 transition-colors ${
                ehHoje
                  ? 'bg-asfalto text-white'
                  : doMes
                    ? 'bg-slate-50 hover:bg-slate-100'
                    : 'bg-white hover:bg-slate-50'
              }`}
            >
              <span
                className={`text-sm font-semibold ${
                  ehHoje ? 'text-white' : doMes ? 'text-slate-600' : 'text-slate-300'
                }`}
              >
                {Number(d.slice(8, 10))}
              </span>

              {c && total > 0 && (
                <span className="mt-auto flex flex-wrap gap-0.5">
                  {PONTOS.map((p) =>
                    Array.from({ length: Math.min(c[p.chave], 6) }, (_, i) => (
                      <span
                        key={`${p.chave}-${i}`}
                        title={p.rotulo}
                        className={`h-1.5 w-1.5 rounded-full ${p.cor}`}
                      />
                    ))
                  )}
                  {total > 6 && (
                    <span className={`text-[10px] ${ehHoje ? 'text-white/70' : 'text-slate-400'}`}>
                      {total}
                    </span>
                  )}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
