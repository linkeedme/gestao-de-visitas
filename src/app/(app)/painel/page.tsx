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
  totaisDoPeriodo,
  serieDiaria,
  porTipo,
} from '@/lib/visita/relatorios'
import { montarAlertas } from '@/lib/visita/alertas'
import { rotuloDoTipo } from '@/lib/visita/tipos'
import { comTeto } from '@/lib/teto'
import { TETO_DA_TELA_S } from '@/lib/prazos'
import type { FiltrosGestao } from '@/lib/rotas'
import { hoje } from '@/lib/visita/datas'
import { intervaloDoFiltro } from '@/lib/visita/periodo'
import { Alertas } from './Alertas'
import { Filtros } from './Filtros'
import { PorPessoa } from './PorPessoa'
import { Auditoria } from './Auditoria'
import { Totais } from './Totais'
import { BarrasPorDia, PorTipo as GraficoPorTipo, Legenda } from './Graficos'

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
 * equipe pessoa a pessoa.
 *
 * A ordem responde na sequência em que as perguntas aparecem: como estamos,
 * o que pede ação, como o trabalho se distribuiu, quem fez o quê, e quais
 * visitas foram. Os totais e os dois gráficos já tinham saído daqui, junto
 * com um gráfico por pessoa — e o argumento valia só para aquele: somar a
 * equipe apagava a pergunta de quem fez o quê. Somar o tempo e o motivo não
 * apaga nada, e sem isso a tela abria direto no detalhe, sem dizer antes de
 * que tamanho era o mês.
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

  const [kpis, foraDoCrm, adiante, emRisco, empurrados, semRelato, vencidas, totais, serie, tipos] =
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
      totaisDoPeriodo(db, de, ate),
      serieDiaria(db, de, ate),
      porTipo(db, de, ate),
    ]))

  const alertas = montarAlertas({ vencidas, empurrados, semRelato, emRisco, foraDoCrm })
  const vendedores = vendedoresDoFiltro(kpis)
  const fatias = tipos.map((t) => ({ rotulo: rotuloDoTipo(t.tipo), n: t.n }))

  return (
    <div className="flex flex-col gap-4">
      <Filtros
        filtros={filtros}
        hojeISO={hojeISO}
        atalhoAtivo={atalhoAtivo}
        vendedores={vendedores}
      />

      {/* O pulso primeiro: sem ele, saber se o mês foi bom exigia somar a
          tabela de pessoas de cabeça. */}
      <Totais totais={totais} adiante={adiante} ate={ate} />

      {/* O que pede ação vem antes do contexto: gráfico explica, alerta cobra. */}
      <Alertas alertas={alertas} />

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Bloco titulo="Movimento no período">
          <BarrasPorDia serie={serie} />
          <div className="mt-3">
            <Legenda />
          </div>
        </Bloco>

        <Bloco titulo="Por tipo de visita">
          <GraficoPorTipo fatias={fatias} />
        </Bloco>
      </div>

      <section>
        <h2 className="px-1 pb-1.5 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
          Equipe
        </h2>
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

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/70">
      <h2 className="pb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
        {titulo}
      </h2>
      {children}
    </section>
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
