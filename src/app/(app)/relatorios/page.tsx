import Link from 'next/link'
import { exigirGestor } from '@/lib/auth/atual'
import { db } from '@/lib/visita/repositorio'
import {
  kpisPorVendedor,
  listarParaAuditoria,
  clientesEmRisco,
  reagendamentosEmSerie,
  realizadasSemRelato,
  atrasadas,
  vendedoresComVisita,
} from '@/lib/visita/relatorios'
import { hoje, somarDias, formatarDia } from '@/lib/visita/datas'
import { rotuloDoTipo } from '@/lib/visita/tipos'

export const dynamic = 'force-dynamic'

const PERIODOS = [
  { dias: 6, rotulo: '7 dias' },
  { dias: 29, rotulo: '30 dias' },
  { dias: 89, rotulo: '90 dias' },
  { dias: 364, rotulo: '1 ano' },
] as const

const STATUS: Record<string, { rotulo: string; cor: string; faixa: string }> = {
  a_fazer: { rotulo: 'A fazer', cor: 'text-fazer', faixa: 'bg-fazer' },
  realizada: { rotulo: 'Realizada', cor: 'text-feita', faixa: 'bg-feita' },
  reagendada: { rotulo: 'Reagendada', cor: 'text-adiada', faixa: 'bg-adiada' },
  cancelada: { rotulo: 'Cancelada', cor: 'text-slate-400', faixa: 'bg-morta' },
}

export default async function Relatorios({ searchParams }: PageProps<'/relatorios'>) {
  await exigirGestor()
  const { periodo, vendedor, status } = await searchParams

  const dias = Number(typeof periodo === 'string' ? periodo : 29)
  const diasValidos = PERIODOS.some((p) => p.dias === dias) ? dias : 29
  const ate = hoje()
  const de = somarDias(ate, -diasValidos)
  const usuarioId = typeof vendedor === 'string' && vendedor ? vendedor : undefined
  const statusFiltro =
    typeof status === 'string' && status in STATUS
      ? (status as 'a_fazer' | 'realizada' | 'cancelada' | 'reagendada')
      : undefined

  const [kpis, visitas, emRisco, empurrados, semRelato, vencidas, vendedores] = await Promise.all([
    kpisPorVendedor(db, de, ate),
    listarParaAuditoria(db, { de, ate, usuarioId, status: statusFiltro }),
    clientesEmRisco(db, ate, 30),
    reagendamentosEmSerie(db, de, ate),
    realizadasSemRelato(db, de, ate),
    atrasadas(db, ate),
    vendedoresComVisita(db, de, ate),
  ])

  const base = `/relatorios?periodo=${diasValidos}`
  const comFiltros = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams({ periodo: String(diasValidos) })
    const v = extra.vendedor ?? usuarioId
    const s = extra.status ?? statusFiltro
    if (v) p.set('vendedor', v)
    if (s) p.set('status', s)
    return `/relatorios?${p}`
  }

  const alertas = vencidas.length + semRelato.length + emRisco.length + empurrados.length

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-semibold">Relatórios</h1>
        <p className="text-sm text-slate-500">
          {formatarDia(de)} a {formatarDia(ate)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PERIODOS.map((p) => (
          <Link
            key={p.dias}
            href={`/relatorios?periodo=${p.dias}`}
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

      {/* Baixar é uma navegação comum: o `download` do navegador cuida do resto,
          sem JavaScript e sem prender o gestor ao que eu imaginei que ele
          precisaria ver. Na planilha ele filtra e soma como quiser. */}
      <a
        href={`/api/relatorios/csv?de=${de}&ate=${ate}${usuarioId ? `&usuarioId=${usuarioId}` : ''}`}
        className="flex items-center justify-center gap-2 rounded-xl bg-asfalto px-4 py-3 font-semibold text-white"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
          <path d="M12 3v12M7 12l5 5 5-5M5 21h14" />
        </svg>
        Baixar planilha do período
      </a>

      {alertas > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Precisa de atenção
          </h2>

          {vencidas.length > 0 && (
            <Alerta
              n={vencidas.length}
              cor="text-adiada"
              titulo={vencidas.length === 1 ? 'visita atrasada' : 'visitas atrasadas'}
              ajuda="Data já passou e continuam a fazer."
              detalhe={vencidas.slice(0, 3).map((v) => `${v.contatoNome} · ${v.vendedor} · ${formatarDia(v.data)}`)}
            />
          )}

          {empurrados.length > 0 && (
            <Alerta
              n={empurrados.length}
              cor="text-adiada"
              titulo={empurrados.length === 1 ? 'cliente reagendado em série' : 'clientes reagendados em série'}
              ajuda="Empurrados duas vezes ou mais. É o negócio que morre sem ninguém perceber."
              detalhe={empurrados.slice(0, 3).map((c) => `${c.contatoNome} · ${c.vezes}× · ${c.vendedor}`)}
            />
          )}

          {semRelato.length > 0 && (
            <Alerta
              n={semRelato.length}
              cor="text-slate-500"
              titulo={semRelato.length === 1 ? 'realizada sem relato' : 'realizadas sem relato'}
              ajuda="Marcadas como feitas sem registro do que foi tratado — não dá para auditar."
              detalhe={semRelato.slice(0, 3).map((v) => `${v.contatoNome} · ${v.vendedor} · ${formatarDia(v.data)}`)}
            />
          )}

          {emRisco.length > 0 && (
            <Alerta
              n={emRisco.length}
              cor="text-slate-500"
              titulo={emRisco.length === 1 ? 'cliente sem visita' : 'clientes sem visita'}
              ajuda="Mais de 30 dias desde a última visita realizada."
              detalhe={emRisco.slice(0, 3).map((c) => `${c.contatoNome} · ${c.diasSem} dias`)}
            />
          )}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          Produtividade por pessoa
        </h2>

        {kpis.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 px-5 py-6 text-center text-sm text-slate-500">
            Nenhuma visita no período.
          </p>
        )}

        {kpis.map((k) => {
          const fechadas = k.realizadas + k.canceladas
          const conclusao = fechadas === 0 ? 0 : Math.round((k.realizadas / fechadas) * 100)
          const porDia = k.diasEmCampo === 0 ? 0 : k.realizadas / k.diasEmCampo
          return (
            <article
              key={k.usuarioId}
              className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg font-semibold">{k.vendedor}</h3>
                  {k.papel === 'gestor' && (
                    <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                      gestor
                    </span>
                  )}
                </div>
                <Link
                  href={comFiltros({ vendedor: k.usuarioId })}
                  className="text-sm font-semibold text-fazer underline-offset-4 hover:underline"
                >
                  ver visitas
                </Link>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Kpi valor={k.realizadas} rotulo="Realizadas" cor="text-feita" />
                <Kpi valor={`${conclusao}%`} rotulo="Conclusão" cor="text-feita" />
                <Kpi valor={k.clientesAlcancados} rotulo="Clientes" cor="text-fazer" />
                <Kpi valor={porDia.toFixed(1)} rotulo="Por dia em campo" cor="text-asfalto" />
              </dl>

              <p className="mt-3 border-t border-slate-100 pt-2 text-sm text-slate-500">
                {k.aFazer} a fazer · {k.reagendadas} reagendadas · {k.canceladas} canceladas
                {k.realizadas > k.comRelato && (
                  <span className="text-adiada">
                    {' '}
                    · {k.realizadas - k.comRelato} sem relato
                  </span>
                )}
              </p>
            </article>
          )
        })}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Visitas ({visitas.length})
          </h2>
          {(usuarioId || statusFiltro) && (
            <Link href={base} className="text-sm font-semibold text-fazer underline-offset-4 hover:underline">
              limpar filtros
            </Link>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Filtro href={comFiltros({ vendedor: '' })} ativo={!usuarioId} rotulo="Todos" />
          {vendedores.map((v) => (
            <Filtro
              key={v.id}
              href={comFiltros({ vendedor: v.id })}
              ativo={usuarioId === v.id}
              rotulo={v.nome.split(' ')[0]}
            />
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Filtro href={comFiltros({ status: '' })} ativo={!statusFiltro} rotulo="Todos os status" />
          {Object.entries(STATUS).map(([chave, s]) => (
            <Filtro
              key={chave}
              href={comFiltros({ status: chave })}
              ativo={statusFiltro === chave}
              rotulo={s.rotulo}
            />
          ))}
        </div>

        {visitas.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 px-5 py-6 text-center text-sm text-slate-500">
            Nenhuma visita com esses filtros.
          </p>
        )}

        {visitas.map((v) => {
          const s = STATUS[v.status]
          return (
            <Link
              key={v.id}
              href={`/visita/${v.id}`}
              className="flex overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70"
            >
              <div className={`w-1.5 shrink-0 ${s.faixa}`} aria-hidden="true" />
              <div className="min-w-0 flex-1 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <h3 className="truncate font-display font-semibold">{v.contatoNome}</h3>
                  <span className={`text-xs font-bold uppercase tracking-wide ${s.cor}`}>
                    {s.rotulo}
                  </span>
                </div>
                <p className="text-sm text-slate-500">
                  {formatarDia(v.data)} · {v.vendedor} · {rotuloDoTipo(v.tipo)}
                </p>
                {v.relatorio ? (
                  <p className="mt-2 line-clamp-3 border-t border-slate-100 pt-2 text-sm text-slate-600">
                    {v.relatorio}
                  </p>
                ) : v.status === 'realizada' ? (
                  <p className="mt-2 border-t border-slate-100 pt-2 text-sm text-adiada">
                    Realizada sem relato do que foi tratado.
                  </p>
                ) : null}
              </div>
            </Link>
          )
        })}
      </section>
    </div>
  )
}

function Kpi({ valor, rotulo, cor }: { valor: string | number; rotulo: string; cor: string }) {
  return (
    <div>
      <dd className={`font-display text-2xl font-semibold ${cor}`}>{valor}</dd>
      <dt className="text-xs text-slate-500">{rotulo}</dt>
    </div>
  )
}

function Filtro({ href, ativo, rotulo }: { href: string; ativo: boolean; rotulo: string }) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
        ativo ? 'bg-asfalto text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
      }`}
    >
      {rotulo}
    </Link>
  )
}

function Alerta({
  n,
  cor,
  titulo,
  ajuda,
  detalhe,
}: {
  n: number
  cor: string
  titulo: string
  ajuda: string
  detalhe: string[]
}) {
  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
      <div className="flex items-baseline gap-2">
        <span className={`font-display text-2xl font-semibold ${cor}`}>{n}</span>
        <h3 className="font-semibold">{titulo}</h3>
      </div>
      <p className="mt-0.5 text-sm text-slate-500">{ajuda}</p>
      <ul className="mt-2 flex flex-col gap-0.5 border-t border-slate-100 pt-2">
        {detalhe.map((d) => (
          <li key={d} className="truncate text-sm text-slate-600">
            {d}
          </li>
        ))}
        {n > detalhe.length && (
          <li className="text-sm text-slate-400">e mais {n - detalhe.length}…</li>
        )}
      </ul>
    </article>
  )
}
