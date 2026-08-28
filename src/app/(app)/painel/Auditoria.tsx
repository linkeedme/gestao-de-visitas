import Link from 'next/link'
import type { FiltrosGestao } from '@/lib/rotas'
import { formatarDia } from '@/lib/visita/datas'
import { rotuloDoTipo } from '@/lib/visita/tipos'
import type { LinhaRelatorio } from '@/lib/visita/relatorios'

const STATUS: Record<string, { rotulo: string; cor: string; faixa: string }> = {
  a_fazer: { rotulo: 'A fazer', cor: 'text-fazer', faixa: 'bg-fazer' },
  realizada: { rotulo: 'Realizada', cor: 'text-feita', faixa: 'bg-feita' },
  reagendada: { rotulo: 'Reagendada', cor: 'text-adiada', faixa: 'bg-adiada' },
  cancelada: { rotulo: 'Cancelada', cor: 'text-slate-400', faixa: 'bg-morta' },
}

/**
 * A auditoria: recolhida no celular, aberta no notebook.
 *
 * O gestor faz duas coisas em dois aparelhos — de manhã confere pelo celular,
 * na reunião audita pelo notebook. Este é o único bloco que o celular esconde,
 * e é justamente o que ele não usa por lá.
 *
 * `<details>` nativo em vez de estado no cliente: decidir por largura de tela
 * no navegador produziria o salto no primeiro render que a navegação já evita
 * de propósito.
 *
 * Vai sem `open`. No celular o navegador esconde o conteúdo sozinho e o toque
 * abre; no notebook o CSS força a seção visível mesmo com o elemento fechado,
 * e esconde o resumo. Que um `<details>` fechado aceite ter o filho revelado
 * por `display` não é óbvio — foi verificado no Chrome antes de escrever isto.
 */
export function Auditoria({
  visitas,
  filtros,
}: {
  visitas: LinhaRelatorio[]
  filtros: FiltrosGestao
}) {
  const { vendedor, status } = filtros

  return (
    <details className="lg:[&>section]:!block">
      <summary className="cursor-pointer list-none rounded-2xl bg-white px-4 py-3 font-semibold shadow-sm ring-1 ring-slate-200/70 lg:hidden">
        Ver visitas do período ({visitas.length})
      </summary>

      <section className="mt-2 flex flex-col gap-2">
        <h2 className="px-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          Visitas ({visitas.length})
          {(vendedor || status) && (
            <span className="ml-1 font-normal normal-case tracking-normal text-slate-400">
              · com os filtros acima
            </span>
          )}
        </h2>

        {/* Baixar é uma navegação comum: o navegador cuida do resto, sem
            JavaScript e sem prender o gestor ao que eu imaginei que ele
            precisaria ver. Na planilha ele filtra e soma como quiser. */}
        <a
          href={`/api/relatorios/csv?de=${filtros.de}&ate=${filtros.ate}${vendedor ? `&usuarioId=${vendedor}` : ''}${status ? `&status=${status}` : ''}`}
          className="flex items-center justify-center gap-2 rounded-xl bg-asfalto px-4 py-3 font-semibold text-white"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M12 3v12M7 12l5 5 5-5M5 21h14" />
          </svg>
          Baixar planilha do período
        </a>

        {visitas.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 px-5 py-6 text-center text-sm text-slate-500">
            Nenhuma visita com esses filtros.
          </p>
        )}

        <div className="grid gap-2 lg:grid-cols-2">
          {visitas.map((v) => {
            const s = STATUS[v.status]
            return (
              <Link
                key={v.id}
                href={`/visita/${v.id}`}
                prefetch={false}
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
        </div>
      </section>
    </details>
  )
}
