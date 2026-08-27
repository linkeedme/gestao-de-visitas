import Link from 'next/link'
import type { VisitaDoDia } from '@/lib/visita/repositorio'
import { rotuloDoTipo } from '@/lib/visita/tipos'

/**
 * A semana inteira numa tela.
 *
 * Ela não fecha visita: tocar num card abre a visita, tocar no dia abre o
 * dia. As ações de status vivem num lugar só, o `ListaDoDia`, e espalhá-las
 * por mais telas garantiria que uma correção futura entrasse em uma e não
 * nas outras.
 *
 * A grade de sete colunas e a lista do celular renderizam os mesmos dados e
 * se alternam por CSS, não por JavaScript: detectar largura no cliente causa
 * um salto visível no primeiro render, como `Navegacao.tsx` já documenta.
 */

const FAIXA: Record<string, string> = {
  a_fazer: 'bg-fazer',
  realizada: 'bg-feita',
  reagendada: 'bg-adiada',
  cancelada: 'bg-morta',
}

const CURTOS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']

export function GradeDaSemana({
  dias,
  visitas,
  hojeISO,
  mostrarVendedor,
  linkDoDia,
}: {
  dias: string[]
  visitas: VisitaDoDia[]
  hojeISO: string
  mostrarVendedor: boolean
  linkDoDia: (data: string) => string
}) {
  const porDia = new Map<string, VisitaDoDia[]>(dias.map((d) => [d, []]))
  for (const v of visitas) porDia.get(v.data)?.push(v)

  return (
    <>
      <div className="hidden grid-cols-7 items-start gap-2 lg:grid">
        {dias.map((d, i) => {
          const doDia = porDia.get(d) ?? []
          return (
            <div key={d} className="flex flex-col gap-1.5">
              <Cabecalho
                href={linkDoDia(d)}
                curto={CURTOS[i]}
                numero={Number(d.slice(8, 10))}
                n={doDia.length}
                ehHoje={d === hojeISO}
              />
              {doDia.map((v) => (
                <Card key={v.id} v={v} mostrarVendedor={mostrarVendedor} />
              ))}
            </div>
          )
        })}
      </div>

      {/* No celular, sete colunas dariam menos de 50px cada e o nome do
          cliente viraria uma letra por linha. A mesma leitura vira lista. */}
      <div className="flex flex-col gap-4 lg:hidden">
        {dias.map((d, i) => {
          const doDia = porDia.get(d) ?? []
          return (
            <section key={d} className="flex flex-col gap-1.5">
              <Cabecalho
                href={linkDoDia(d)}
                curto={CURTOS[i]}
                numero={Number(d.slice(8, 10))}
                n={doDia.length}
                ehHoje={d === hojeISO}
              />
              {doDia.length === 0 ? (
                <p className="px-1 text-sm text-slate-400">Nada agendado.</p>
              ) : (
                doDia.map((v) => <Card key={v.id} v={v} mostrarVendedor={mostrarVendedor} />)
              )}
            </section>
          )
        })}
      </div>
    </>
  )
}

function Cabecalho({
  href,
  curto,
  numero,
  n,
  ehHoje,
}: {
  href: string
  curto: string
  numero: number
  n: number
  ehHoje: boolean
}) {
  return (
    <Link
      href={href}
      className={`flex items-baseline justify-between rounded-xl px-2.5 py-2 transition-colors ${
        ehHoje ? 'bg-asfalto text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
      }`}
    >
      <span className="text-xs font-bold uppercase tracking-wide">{curto}</span>
      <span className="font-display text-lg font-semibold">{numero}</span>
      <span className={`text-xs ${ehHoje ? 'text-white/60' : 'text-slate-400'}`}>{n || '—'}</span>
    </Link>
  )
}

function Card({ v, mostrarVendedor }: { v: VisitaDoDia; mostrarVendedor: boolean }) {
  return (
    <Link
      href={`/visita/${v.id}`}
      className="flex overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70"
    >
      <div className={`w-1.5 shrink-0 ${FAIXA[v.status] ?? 'bg-morta'}`} aria-hidden="true" />
      <div className="min-w-0 flex-1 px-2.5 py-2">
        <p className="truncate font-display text-sm font-semibold">{v.contatoNome}</p>
        <p className="truncate text-xs text-slate-500">
          {rotuloDoTipo(v.tipo)}
          {mostrarVendedor && ` · ${v.vendedor.split(' ')[0]}`}
        </p>
      </div>
    </Link>
  )
}
