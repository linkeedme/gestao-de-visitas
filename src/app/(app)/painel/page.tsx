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
  vendedoresDoFiltro,
  clientesEmRisco,
  reagendamentosEmSerie,
  realizadasSemRelato,
  atrasadas,
} from '@/lib/visita/relatorios'
import { montarAlertas } from '@/lib/visita/alertas'
import { comTeto } from '@/lib/teto'
import { TETO_DA_TELA_S } from '@/lib/prazos'
import type { FiltrosGestao } from '@/lib/rotas'
import { hoje, somarDias } from '@/lib/visita/datas'
import { intervaloDoFiltro } from '@/lib/visita/periodo'
import { Alertas } from './Alertas'
import { Filtros } from './Filtros'
import { PorPessoa } from './PorPessoa'
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
 * A ordem responde ao trabalho do gestor: o recorte, o que pede ação, e a
 * equipe pessoa a pessoa. Os totais do time saíram junto com os gráficos —
 * somar a equipe apaga exatamente a pergunta que ele veio fazer, que é como
 * cada um está indo.
 */
export default async function Gestao({ searchParams }: PageProps<'/painel'>) {
  await exigirGestor()
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

  const [kpis, foraDoCrm, adiante, emRisco, empurrados, semRelato, vencidas] =
    await comTeto('painel:consultas', TETO_DA_TELA_S, () => Promise.all([
      kpisPorVendedor(db, de, ate),
      listarNaoSincronizadas(db),
      contarAgendadasAdiante(db, ate),
      // Estes dois recebem `hojeISO`, não `ate`: atraso é uma pergunta sobre o
      // presente. Com intervalo livre, passar `ate` faria a tela de julho
      // responder o que estava atrasado em julho — e o gestor leria como
      // situação de agora.
      clientesEmRisco(db, hojeISO, 30),
      reagendamentosEmSerie(db, de, ate),
      realizadasSemRelato(db, de, ate),
      atrasadas(db, hojeISO),
    ]))

  const alertas = montarAlertas({ vencidas, empurrados, semRelato, emRisco, foraDoCrm })
  const vendedores = vendedoresDoFiltro(kpis)

  return (
    <div className="flex flex-col gap-4">
      <Filtros
        filtros={filtros}
        hojeISO={hojeISO}
        atalhoAtivo={atalhoAtivo}
        vendedores={vendedores}
      />

      {/* O que pede ação vem antes de tudo: gráfico é contexto, alerta é
          trabalho. */}
      <Alertas alertas={alertas} />

      <section>
        <div className="flex items-baseline justify-between px-1 pb-1.5">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Equipe</h2>
          {adiante > 0 && (
            <Link
              href={`/agenda?data=${somarDias(ate, 1)}`}
              prefetch={false}
              className="text-sm text-slate-500 underline-offset-4 hover:underline"
            >
              {adiante} {adiante === 1 ? 'visita marcada' : 'visitas marcadas'} depois deste período
            </Link>
          )}
        </div>
        <PorPessoa linhas={kpis} filtros={filtros} />
      </section>

      {/* ❺ A auditoria tem as duas consultas mais pesadas e é a menos urgente:
          num boundary próprio, ela não segura o resto da página. */}
      <Suspense fallback={<EsqueletoAuditoria />}>
        <BlocoAuditoria filtros={filtros} />
      </Suspense>
    </div>
  )
}

async function BlocoAuditoria({ filtros }: { filtros: FiltrosGestao }) {
  const visitas = await listarParaAuditoria(db, {
    de: filtros.de,
    ate: filtros.ate,
    usuarioId: filtros.vendedor,
    status: filtros.status as StatusFiltro | undefined,
  })

  return <Auditoria visitas={visitas} filtros={filtros} />
}

function EsqueletoAuditoria() {
  return (
    <div className="h-32 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200/70 motion-reduce:animate-none" />
  )
}
