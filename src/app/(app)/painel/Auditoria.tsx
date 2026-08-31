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
 * As visitas do período, sempre visíveis.
 *
 * Este bloco já foi um `<details>` que o CSS abria só no notebook, com o
 * argumento de que o gestor audita no computador e não no celular. Ficou
 * invisível NAS DUAS telas, e ninguém percebeu por dias: no notebook o resumo
 * que abriria estava escondido por `lg:hidden`, e a regra que revelaria a
 * seção não vencia o `<details>` fechado. O Chrome trata o conteúdo fechado
 * com `content-visibility`, e `display:block` no filho não ganha disso — o
 * comentário antigo dizia ter verificado no Chrome, e provavelmente tinha:
 * uma atualização do navegador desfez a verificação em silêncio.
 *
 * A lição que fica no lugar: esconder conteúdo por CSS que depende do
 * comportamento interno de um elemento nativo é frágil demais para o que se
 * ganha. A lista agora aparece sempre, cortada no que cabe, com o resto a um
 * clique.
 */
const MOSTRAR = 12

export function Auditoria({
  visitas,
  filtros,
}: {
  visitas: LinhaRelatorio[]
  filtros: FiltrosGestao
}) {
  const { vendedor, status } = filtros
  const visiveis = visitas.slice(0, MOSTRAR)
  const escondidas = visitas.length - visiveis.length

  return (
    <div>
      <section className="mt-2 flex flex-col gap-2">
        {/* O título e a planilha dividem a linha. Antes o botão de baixar
            ocupava a largura inteira em preto sólido, e virava o elemento mais
            forte do bloco — gritando mais alto que as próprias visitas, que
            são o conteúdo. Exportar é saída, não destino. */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
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
            className="flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-slate-600 ring-1 ring-slate-300 transition-colors hover:bg-white hover:text-asfalto"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M12 3v12M7 12l5 5 5-5M5 21h14" />
            </svg>
            Planilha
          </a>
        </div>

        {visitas.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 px-5 py-6 text-center text-sm text-slate-500">
            Nenhuma visita com esses filtros.
          </p>
        )}

        <div className="grid gap-2 lg:grid-cols-2">
          {visiveis.map((v) => {
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

        {/* O corte é dito, e não silencioso: uma lista que para no décimo
            segundo sem avisar faz o gestor achar que o período tem menos
            visita do que tem. A planilha acima leva tudo. */}
        {escondidas > 0 && (
          <p className="px-1 text-sm text-slate-500">
            Mostrando {MOSTRAR} de {visitas.length}. As outras {escondidas} estão na planilha.
          </p>
        )}
      </section>
    </div>
  )
}
