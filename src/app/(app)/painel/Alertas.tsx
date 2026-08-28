import type { Alerta } from '@/lib/visita/alertas'

/**
 * O que pede ação, numa lista densa.
 *
 * Eram quatro cartões numa grade de duas colunas: com três alertas sobrava
 * meia linha vazia, e cada cartão gastava altura repetindo moldura e sombra
 * para dizer um número e uma frase. Como lista, os quatro cabem numa olhada e
 * a leitura é vertical, que é como se lê uma lista de pendências.
 *
 * Vem antes da equipe porque é a única parte da tela que pede alguma coisa —
 * o resto informa.
 */
export function Alertas({ alertas }: { alertas: Alerta[] }) {
  if (alertas.length === 0) return null

  return (
    <section>
      <h2 className="px-1 pb-1.5 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
        Precisa de atenção
      </h2>

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200/70">
        {alertas.map((a) => (
          <li key={a.chave} className="flex items-baseline gap-3 px-4 py-3">
            <span
              className={`w-7 shrink-0 text-right font-display text-xl font-semibold tabular-nums ${
                a.tom === 'urgente' ? 'text-adiada' : 'text-slate-400'
              }`}
            >
              {a.n}
            </span>

            <div className="min-w-0 flex-1">
              <p className="font-semibold">{a.titulo}</p>
              <p className="text-sm text-slate-500">{a.ajuda}</p>

              {/* Os exemplos ficam numa linha só, separados por vírgula. Em
                  lista vertical eles pareciam registros repetidos — três linhas
                  quase idênticas seguidas leem como erro, não como amostra. */}
              <p className="mt-1 truncate text-sm text-slate-600">
                {a.detalhe.join(' · ')}
                {a.n > a.detalhe.length && (
                  <span className="text-slate-400"> · e mais {a.n - a.detalhe.length}</span>
                )}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
