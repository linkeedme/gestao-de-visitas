import Link from 'next/link'
import { exigirGestor } from '@/lib/auth/atual'
import {
  resumoPorVendedor,
  listarNaoSincronizadas,
  contarAgendadasAdiante,
  db,
} from '@/lib/visita/repositorio'
import { hoje, somarDias, formatarDia } from '@/lib/visita/datas'

export const dynamic = 'force-dynamic'

const PERIODOS = [
  { dias: 0, rotulo: 'Hoje' },
  { dias: 6, rotulo: '7 dias' },
  { dias: 29, rotulo: '30 dias' },
  { dias: 89, rotulo: '90 dias' },
] as const

/** As quatro colunas, na ordem em que o gestor lê: o que rendeu primeiro. */
const COLUNAS = [
  { chave: 'realizadas', rotulo: 'Realizadas', cor: 'text-feita', faixa: 'bg-feita' },
  { chave: 'aFazer', rotulo: 'A fazer', cor: 'text-fazer', faixa: 'bg-fazer' },
  { chave: 'reagendadas', rotulo: 'Reagendadas', cor: 'text-adiada', faixa: 'bg-adiada' },
  { chave: 'canceladas', rotulo: 'Canceladas', cor: 'text-slate-400', faixa: 'bg-morta' },
] as const

export default async function Painel({ searchParams }: PageProps<'/painel'>) {
  await exigirGestor()
  const { periodo } = await searchParams

  const dias = Number(typeof periodo === 'string' ? periodo : 29)
  const diasValidos = PERIODOS.some((p) => p.dias === dias) ? dias : 29
  const ate = hoje()
  const de = somarDias(ate, -diasValidos)

  const [linhas, pendentes, adiante] = await Promise.all([
    resumoPorVendedor(db, de, ate),
    listarNaoSincronizadas(db),
    contarAgendadasAdiante(db, ate),
  ])

  const total = linhas.reduce(
    (acc, l) => ({
      aFazer: acc.aFazer + l.aFazer,
      realizadas: acc.realizadas + l.realizadas,
      canceladas: acc.canceladas + l.canceladas,
      reagendadas: acc.reagendadas + l.reagendadas,
      total: acc.total + l.total,
    }),
    { aFazer: 0, realizadas: 0, canceladas: 0, reagendadas: 0, total: 0 }
  )

  const fechadas = total.realizadas + total.canceladas
  const conclusao = fechadas === 0 ? 0 : Math.round((total.realizadas / fechadas) * 100)

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-semibold">Painel</h1>
        <p className="text-sm text-slate-500">
          {diasValidos === 0 ? formatarDia(ate) : `${formatarDia(de)} a ${formatarDia(ate)}`}
          {total.total > 0 && ` · ${total.total} ${total.total === 1 ? 'visita' : 'visitas'}`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PERIODOS.map((p) => (
          <Link
            key={p.dias}
            href={`/painel?periodo=${p.dias}`}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              p.dias === diasValidos
                ? 'bg-asfalto text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {p.rotulo}
          </Link>
        ))}
      </div>

      {/* O período termina hoje, o que serve para o que já aconteceu. Visita a
          fazer vive no futuro: sem esta linha, o painel mostraria menos
          trabalho do que existe, e a semana seria planejada às cegas. */}
      {adiante > 0 && (
        <Link
          href={`/agenda?data=${somarDias(ate, 1)}`}
          className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200/70"
        >
          <span className="font-display text-2xl font-semibold text-fazer">{adiante}</span>
          <span className="text-sm text-slate-700">
            {adiante === 1 ? 'visita agendada' : 'visitas agendadas'} depois de hoje
            <span className="block text-slate-500">Fora do período acima. Toque para ver.</span>
          </span>
        </Link>
      )}

      <section className="grid grid-cols-2 gap-3">
        {COLUNAS.map((c) => (
          <div key={c.chave} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${c.faixa}`} aria-hidden="true" />
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {c.rotulo}
              </p>
            </div>
            <p className={`font-display text-4xl font-semibold ${c.cor}`}>{total[c.chave]}</p>
          </div>
        ))}
      </section>

      {fechadas > 0 && (
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
              Taxa de conclusão
            </h2>
            <span className="font-display text-2xl font-semibold text-feita">{conclusao}%</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {total.realizadas} realizadas de {fechadas} visitas fechadas. Reagendar não conta
            como fechar.
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-feita" style={{ width: `${conclusao}%` }} />
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          Por colaborador
        </h2>

        {linhas.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-slate-500">
            Nenhuma visita neste período.
          </p>
        )}

        {linhas.map((l) => (
          <article
            key={l.usuarioId}
            className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-lg font-semibold">{l.vendedor}</h3>
                {l.papel === 'gestor' && (
                  <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                    gestor
                  </span>
                )}
              </div>
              <span className="text-sm text-slate-500">
                {l.total} {l.total === 1 ? 'visita' : 'visitas'}
              </span>
            </div>

            {/* A barra é a divisão real do trabalho dele no período, não enfeite:
                cada faixa é uma fatia dos quatro status. */}
            <div className="mt-2.5 flex h-1.5 overflow-hidden rounded-full bg-slate-100">
              {COLUNAS.map((c) => (
                <Faixa key={c.chave} n={l[c.chave]} de={l.total} cor={c.faixa} />
              ))}
            </div>

            <dl className="mt-3 grid grid-cols-4 gap-2">
              {COLUNAS.map((c) => (
                <div key={c.chave}>
                  <dd className={`font-display text-2xl font-semibold ${c.cor}`}>{l[c.chave]}</dd>
                  <dt className="text-xs text-slate-500">{c.rotulo}</dt>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </section>

      {pendentes.length > 0 && (
        <Link
          href="/admin"
          className="flex items-center gap-3 rounded-2xl bg-adiada/10 px-4 py-3 ring-1 ring-adiada/30"
        >
          <span className="font-display text-2xl font-semibold text-adiada">
            {pendentes.length}
          </span>
          <span className="text-sm text-slate-700">
            {pendentes.length === 1 ? 'visita não chegou' : 'visitas não chegaram'} ao CRM.
            <span className="block text-slate-500">Toque para reprocessar.</span>
          </span>
        </Link>
      )}
    </div>
  )
}

function Faixa({ n, de, cor }: { n: number; de: number; cor: string }) {
  if (n === 0 || de === 0) return null
  return <div className={cor} style={{ width: `${(n / de) * 100}%` }} />
}
