import Link from 'next/link'
import { exigirGestor } from '@/lib/auth/atual'
import {
  resumoPorVendedor,
  listarNaoSincronizadas,
  contarAgendadasAdiante,
  db,
} from '@/lib/visita/repositorio'
import {
  serieDiaria,
  porTipo,
  clientesEmRisco,
  reagendamentosEmSerie,
} from '@/lib/visita/relatorios'
import { hoje, somarDias, formatarDia } from '@/lib/visita/datas'
import { rotuloDoTipo } from '@/lib/visita/tipos'
import { BarrasPorDia, BarrasPorPessoa, PorTipo, Legenda, CORES } from './Graficos'

export const dynamic = 'force-dynamic'

const PERIODOS = [
  { dias: 6, rotulo: '7 dias' },
  { dias: 29, rotulo: '30 dias' },
  { dias: 89, rotulo: '90 dias' },
] as const

export default async function Painel({ searchParams }: PageProps<'/painel'>) {
  await exigirGestor()
  const { periodo } = await searchParams

  const dias = Number(typeof periodo === 'string' ? periodo : 29)
  const diasValidos = PERIODOS.some((p) => p.dias === dias) ? dias : 29
  const ate = hoje()
  const de = somarDias(ate, -diasValidos)

  const [linhas, pendentes, adiante, serie, tipos, emRisco, empurrados] = await Promise.all([
    resumoPorVendedor(db, de, ate),
    listarNaoSincronizadas(db),
    contarAgendadasAdiante(db, ate),
    serieDiaria(db, de, ate),
    porTipo(db, de, ate),
    clientesEmRisco(db, ate, 30),
    reagendamentosEmSerie(db, de, ate),
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
  const emCampo = serie.filter((d) => d.realizadas > 0).length
  const mediaDia = emCampo === 0 ? 0 : total.realizadas / emCampo

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Painel</h1>
          <p className="text-sm text-slate-500">
            {formatarDia(de)} a {formatarDia(ate)}
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
      </div>

      {/* O número que responde à pergunta do gestor antes de qualquer gráfico:
          quanto de trabalho foi feito. O resto contextualiza. */}
      <section className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl bg-asfalto p-5 text-white shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">
            Visitas realizadas
          </p>
          <p className="font-display text-6xl font-semibold leading-none">{total.realizadas}</p>
          <p className="mt-2 text-sm text-white/70">
            {mediaDia.toFixed(1)} por dia em campo · {emCampo}{' '}
            {emCampo === 1 ? 'dia com visita' : 'dias com visita'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:col-span-2">
          <Cartao valor={total.aFazer} rotulo="A fazer" cor={CORES.aFazer} />
          <Cartao valor={total.reagendadas} rotulo="Reagendadas" cor={CORES.reagendadas} />
          <Cartao valor={total.canceladas} rotulo="Canceladas" cor={CORES.canceladas} />
          <Cartao
            valor={`${conclusao}%`}
            rotulo="Conclusão"
            cor={CORES.realizadas}
            ajuda={`${total.realizadas} de ${fechadas} fechadas`}
          />
        </div>
      </section>

      {adiante > 0 && (
        <Link
          href={`/agenda?data=${somarDias(ate, 1)}`}
          className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200/70"
        >
          <span className="font-display text-2xl font-semibold" style={{ color: CORES.aFazer }}>
            {adiante}
          </span>
          <span className="text-sm text-slate-700">
            {adiante === 1 ? 'visita agendada' : 'visitas agendadas'} depois de hoje
            <span className="block text-slate-500">Fora do período acima. Toque para ver.</span>
          </span>
        </Link>
      )}

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Movimento por dia</h2>
          <Legenda />
        </div>
        <BarrasPorDia serie={serie} />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
          <h2 className="mb-4 font-display text-lg font-semibold">Por pessoa</h2>
          <BarrasPorPessoa
            linhas={linhas.map((l) => ({
              id: l.usuarioId,
              nome: l.vendedor,
              realizadas: l.realizadas,
              aFazer: l.aFazer,
              reagendadas: l.reagendadas,
              canceladas: l.canceladas,
            }))}
          />
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
          <h2 className="mb-4 font-display text-lg font-semibold">Tipo de visita</h2>
          <PorTipo fatias={tipos.map((t) => ({ rotulo: rotuloDoTipo(t.tipo), n: t.n }))} />
        </section>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {empurrados.length > 0 && (
          <Aviso
            n={empurrados.length}
            cor={CORES.reagendadas}
            titulo={empurrados.length === 1 ? 'cliente empurrado' : 'clientes empurrados'}
            ajuda="Reagendados duas vezes ou mais."
            href="/relatorios"
          />
        )}
        {emRisco.length > 0 && (
          <Aviso
            n={emRisco.length}
            cor={CORES.canceladas}
            titulo={emRisco.length === 1 ? 'cliente sem visita' : 'clientes sem visita'}
            ajuda="Mais de 30 dias desde a última."
            href="/relatorios"
          />
        )}
        {pendentes.length > 0 && (
          <Aviso
            n={pendentes.length}
            cor={CORES.reagendadas}
            titulo={pendentes.length === 1 ? 'visita fora do CRM' : 'visitas fora do CRM'}
            ajuda="Salvas aqui, ainda não enviadas."
            href="/admin"
          />
        )}
      </div>

      <Link
        href="/relatorios"
        className="flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/70 transition-colors hover:bg-slate-50"
      >
        Ver relatórios e exportar planilha
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  )
}

function Cartao({
  valor,
  rotulo,
  cor,
  ajuda,
}: {
  valor: string | number
  rotulo: string
  cor: string
  ajuda?: string
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cor }} aria-hidden="true" />
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{rotulo}</p>
      </div>
      <p className="font-display text-3xl font-semibold" style={{ color: cor }}>
        {valor}
      </p>
      {ajuda && <p className="text-xs text-slate-400">{ajuda}</p>}
    </div>
  )
}

function Aviso({
  n,
  cor,
  titulo,
  ajuda,
  href,
}: {
  n: number
  cor: string
  titulo: string
  ajuda: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200/70 transition-colors hover:bg-slate-50"
    >
      <span className="font-display text-2xl font-semibold" style={{ color: cor }}>
        {n}
      </span>
      <span className="min-w-0 text-sm text-slate-700">
        {titulo}
        <span className="block truncate text-slate-500">{ajuda}</span>
      </span>
    </Link>
  )
}
