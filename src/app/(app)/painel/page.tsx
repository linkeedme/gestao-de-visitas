import { Suspense } from 'react'
import Link from 'next/link'
import { exigirGestor } from '@/lib/auth/atual'
import {
  db,
  listarNaoSincronizadas,
  contarAgendadasAdiante,
} from '@/lib/visita/repositorio'
import {
  kpisPorVendedor,
  listarParaAuditoria,
  vendedoresComVisita,
  serieDiaria,
  porTipo,
  clientesEmRisco,
  reagendamentosEmSerie,
  realizadasSemRelato,
  atrasadas,
} from '@/lib/visita/relatorios'
import { montarAlertas } from '@/lib/visita/alertas'
import { medir } from '@/lib/medir'
import { linkDaGestao, type FiltrosGestao } from '@/lib/rotas'
import { hoje, somarDias, formatarDia } from '@/lib/visita/datas'
import { ATALHOS, intervaloDoFiltro } from '@/lib/visita/periodo'
import { rotuloDoTipo } from '@/lib/visita/tipos'
import { BarrasPorDia, BarrasPorPessoa, PorTipo, Legenda, CORES } from './Graficos'
import { Alertas } from './Alertas'
import { Auditoria } from './Auditoria'

export const dynamic = 'force-dynamic'

const STATUS_VALIDOS = ['a_fazer', 'realizada', 'cancelada', 'reagendada'] as const
type StatusFiltro = (typeof STATUS_VALIDOS)[number]

/**
 * A tela de gestão.
 *
 * Nasceu da fusão de duas: painel e relatórios mostravam os mesmos dois
 * alertas e respondiam "por pessoa" com consultas diferentes. O gestor
 * precisava abrir as duas para ter um quadro.
 *
 * A ordem é número, problema, contexto, pessoa, detalhe. Os alertas vêm antes
 * dos gráficos porque são a única parte que pede ação — gráfico é contexto,
 * alerta é trabalho.
 */
export default async function Gestao({ searchParams }: PageProps<'/painel'>) {
  const tudo = Date.now()
  await medir('painel:auth', () => exigirGestor())
  const { de: deParam, ate: ateParam, periodo, vendedor, status } = await searchParams

  const texto = (v: unknown) => (typeof v === 'string' && v ? v : undefined)
  const hojeISO = hoje()

  // O mesmo filtro que os relatórios usavam: aceita intervalo livre e ainda
  // entende o `?periodo=` antigo, então os links de painel já salvos por aí
  // continuam chegando na tela certa.
  const { de, ate, atalhoAtivo } = intervaloDoFiltro(
    { de: texto(deParam), ate: texto(ateParam), periodo: texto(periodo) },
    hojeISO
  )
  const usuarioId = texto(vendedor)
  const statusFiltro = STATUS_VALIDOS.includes(status as StatusFiltro)
    ? (status as StatusFiltro)
    : undefined

  const filtros: FiltrosGestao = { de, ate, vendedor: usuarioId, status: statusFiltro }

  const [kpis, foraDoCrm, adiante, serie, tipos, emRisco, empurrados, semRelato, vencidas] =
    await medir('painel:9consultas', () => Promise.all([
      kpisPorVendedor(db, de, ate),
      listarNaoSincronizadas(db),
      contarAgendadasAdiante(db, ate),
      serieDiaria(db, de, ate),
      porTipo(db, de, ate),
      // Estes dois recebem `hojeISO`, não `ate`: atraso é uma pergunta sobre o
      // presente. Com intervalo livre, passar `ate` faria a tela de julho
      // responder o que estava atrasado em julho — e o gestor leria como
      // situação de agora.
      clientesEmRisco(db, hojeISO, 30),
      reagendamentosEmSerie(db, de, ate),
      realizadasSemRelato(db, de, ate),
      atrasadas(db, hojeISO),
    ]))

  console.log(`[PERF] painel:ate-render ${Date.now() - tudo}ms`)

  const alertas = montarAlertas({ vencidas, empurrados, semRelato, emRisco, foraDoCrm })

  const total = kpis.reduce(
    (acc, l) => ({
      aFazer: acc.aFazer + l.aFazer,
      realizadas: acc.realizadas + l.realizadas,
      canceladas: acc.canceladas + l.canceladas,
      reagendadas: acc.reagendadas + l.reagendadas,
    }),
    { aFazer: 0, realizadas: 0, canceladas: 0, reagendadas: 0 }
  )

  const fechadas = total.realizadas + total.canceladas
  const conclusao = fechadas === 0 ? 0 : Math.round((total.realizadas / fechadas) * 100)
  const emCampo = serie.filter((d) => d.realizadas > 0).length
  const mediaDia = emCampo === 0 ? 0 : total.realizadas / emCampo

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Gestão</h1>
          <p className="text-sm text-slate-500">
            {formatarDia(de)} a {formatarDia(ate)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ATALHOS.map((a) => (
            <Link
              key={a.dias}
              href={linkDaGestao({
                ...filtros,
                de: somarDias(hojeISO, -a.dias),
                ate: hojeISO,
              })}
              prefetch={false}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                a.dias === atalhoAtivo
                  ? 'bg-asfalto text-white'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {a.rotulo}
            </Link>
          ))}
        </div>
      </div>

      {/* ❶ O número que responde à pergunta do gestor antes de qualquer
          gráfico: quanto de trabalho foi feito. O resto contextualiza. */}
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
          prefetch={false}
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

      {/* ❷ O acionável, antes do ilustrativo. */}
      <Alertas alertas={alertas} />

      {/* ❸ Contexto. */}
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Movimento por dia</h2>
          <Legenda />
        </div>
        <BarrasPorDia serie={serie} />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ❹ Por pessoa, agora numa versão só. */}
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
          <h2 className="mb-4 font-display text-lg font-semibold">Por pessoa</h2>
          <BarrasPorPessoa linhas={kpis} />
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
          <h2 className="mb-4 font-display text-lg font-semibold">Tipo de visita</h2>
          <PorTipo fatias={tipos.map((t) => ({ rotulo: rotuloDoTipo(t.tipo), n: t.n }))} />
        </section>
      </div>

      {/* ❺ A auditoria tem as duas consultas mais pesadas e é a menos urgente:
          num boundary próprio, ela não segura o resto da página. */}
      <Suspense fallback={<EsqueletoAuditoria />}>
        <BlocoAuditoria filtros={filtros} />
      </Suspense>
    </div>
  )
}

async function BlocoAuditoria({ filtros }: { filtros: FiltrosGestao }) {
  const [visitas, vendedores] = await medir('painel:auditoria', () => Promise.all([
    listarParaAuditoria(db, {
      de: filtros.de,
      ate: filtros.ate,
      usuarioId: filtros.vendedor,
      status: filtros.status as StatusFiltro | undefined,
    }),
    vendedoresComVisita(db, filtros.de, filtros.ate),
  ]))

  return <Auditoria visitas={visitas} vendedores={vendedores} filtros={filtros} />
}

function EsqueletoAuditoria() {
  return (
    <div className="h-32 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200/70 motion-reduce:animate-none" />
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
